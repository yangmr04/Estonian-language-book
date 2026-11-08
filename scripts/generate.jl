# Turns the notebook in notebook/ into Franklin pages in site/.
# Generated: site/index.md, site/sections.md, site/lessons/*.md, site/_assets/search-index.json

const ROOT = dirname(@__DIR__)
const SITE = joinpath(ROOT, "site")
const LESSONS_SRC = joinpath(ROOT, "notebook", "lessons")

fix_links(s) = replace(s,
    r"\]\(lessons/(lesson-\d+)\.md\)" => s"](/lessons/\1/)",
    r"\]\((lesson-\d+)\.md\)" => s"](/lessons/\1/)",
    "](../README.md)" => "](/)")

# Franklin reads a run of underscores as emphasis, so fill-in blanks become entities.
fix_blanks(s) = replace(s, r"_{2,}" => m -> "&#95;"^length(m))

# Franklin can't nest italics inside a bold line, so a bold label drops its inner italics.
function fix_bold_label(s)
    m = match(r"^\*\*(.*)\*\*$", s)
    return m === nothing ? s : "**" * replace(m[1], "*" => "") * "**"
end

function section_numbers(heading)
    numbers = Int[]
    for m in eachmatch(r"§+\s*([\d,\s–-]+)", heading), piece in split(m[1], ",")
        range = match(r"(\d+)\s*[–-]\s*(\d+)", piece)
        if range !== nothing
            append!(numbers, parse(Int, range[1]):parse(Int, range[2]))
        else
            single = match(r"\d+", piece)
            single !== nothing && push!(numbers, parse(Int, single.match))
        end
    end
    return numbers
end

plain(s) = strip(replace(s, r"\[([^\]]*)\]\([^)]*\)" => s"\1", r"[*`|#]+" => " ", r"-{3,}" => " ", r"\s+" => " "))
clean_heading(s) = strip(replace(s, r"^#+\s*" => "", r"\s*\(§[^)]*\)\s*$" => "", "*" => ""))

function json_string(s)
    out = IOBuffer()
    print(out, '"')
    for c in String(s)
        if c == '"' || c == '\\'
            print(out, '\\', c)
        elseif c == '\n'
            print(out, "\\n")
        elseif c < ' '
            print(out, ' ')
        else
            print(out, c)
        end
    end
    print(out, '"')
    return String(take!(out))
end

function convert_lesson(path, slug, search, owners)
    lines = readlines(path)
    heading = strip(replace(lines[1], r"^#\s*" => ""))
    title = replace(heading, "*" => "")
    number = parse(Int, match(r"\d+", slug).match)
    nav = fix_links(lines[3])

    out = String["@def title = $(repr(String(title)))", "", "# $heading", "", "~~~<nav class=\"lesson-nav\">~~~", nav, "~~~</nav>~~~", ""]
    seen = Set{Int}()
    heading_id = 0
    in_answers = false
    entry = nothing

    function flush_entry!()
        entry === nothing || push!(search, entry)
        entry = nothing
    end

    for line in lines[4:end]
        if startswith(strip(line), "<details>")
            in_answers = true
            push!(out, "~~~<details class=\"answers\">~~~")
        elseif startswith(strip(line), "<summary>")
            label = replace(strip(line), r"</?summary>" => "")
            push!(out, "~~~<summary>$label</summary>~~~", "")
        elseif startswith(strip(line), "</details>")
            in_answers = false
            push!(out, "", "~~~</details>~~~")
        elseif startswith(line, "##")
            flush_entry!()
            heading_id += 1
            numbers = section_numbers(line)
            anchors = ["<a id=\"h-$heading_id\" class=\"anchor\"></a>"]
            for n in numbers
                n in seen && continue
                push!(seen, n)
                haskey(owners, n) || (owners[n] = (number, slug))
                push!(anchors, "<a id=\"s-$n\" class=\"anchor\"></a>")
            end
            push!(out, "~~~" * join(anchors) * "~~~", "", fix_blanks(line))
            entry = Dict("lesson" => number, "lessonTitle" => String(title),
                "url" => "/lessons/$slug/#h-$heading_id",
                "title" => String(clean_heading(line)), "secs" => numbers, "text" => "")
        else
            push!(out, fix_bold_label(fix_blanks(fix_links(line))))
            if entry !== nothing && !in_answers
                entry["text"] *= " " * plain(line)
            end
        end
    end
    flush_entry!()
    push!(out, "", "~~~<nav class=\"lesson-nav\">~~~", nav, "~~~</nav>~~~", "")
    write(joinpath(SITE, "lessons", slug * ".md"), join(out, "\n"))
    return (number = number, slug = slug, title = String(title))
end

function write_home()
    readme = read(joinpath(ROOT, "notebook", "README.md"), String)
    table = fix_links(split(readme, "## Lessons")[2])
    intro = """
    @def title = "Estonian Study Notebook"

    # Estonian Study Notebook

    Original grammar notes and exercises for learners of Estonian, in 40 lessons.

    The lessons follow the topic order of Juhan Tuldava's *Estonian Textbook: Grammar, Exercises, Conversation* (Indiana University, 1994), and `§` numbers point to the matching sections of that book. The explanations, examples and exercises here are independently written, and this site isn't affiliated with the book or its publisher.

    Use the search box to find a topic, an Estonian word or a section such as `§ 66`, or browse the [section index](/sections/). Exercise answers stay folded until you open them, and they aren't included in search.

    ## Lessons
    """
    write(joinpath(SITE, "index.md"), intro * table)
end

function write_section_index(lessons, owners)
    out = ["@def title = \"Section Index\"", "", "# Section Index", "",
        "Every section number, linked to the notes that cover it.", ""]
    for lesson in lessons
        numbers = sort([n for (n, owner) in owners if owner[1] == lesson.number])
        isempty(numbers) && continue
        push!(out, "## [$(lesson.title)](/lessons/$(lesson.slug)/)", "")
        links = join(["<a href=\"/lessons/$(lesson.slug)/#s-$n\">§ $n</a>" for n in numbers])
        push!(out, "~~~<div class=\"section-grid\">$links</div>~~~", "")
    end
    write(joinpath(SITE, "sections.md"), join(out, "\n"))
end

function write_search_index(search)
    items = map(search) do e
        "{\"lesson\":$(e["lesson"]),\"lessonTitle\":$(json_string(e["lessonTitle"]))," *
        "\"url\":$(json_string(e["url"])),\"title\":$(json_string(e["title"]))," *
        "\"secs\":[$(join(e["secs"], ","))],\"text\":$(json_string(strip(e["text"])))}"
    end
    mkpath(joinpath(SITE, "_assets"))
    write(joinpath(SITE, "_assets", "search-index.json"), "[" * join(items, ",\n") * "]")
end

function generate()
    mkpath(joinpath(SITE, "lessons"))
    search, owners = Any[], Dict{Int,Tuple{Int,String}}()
    lessons = map(sort(filter(endswith(".md"), readdir(LESSONS_SRC)))) do file
        convert_lesson(joinpath(LESSONS_SRC, file), replace(file, ".md" => ""), search, owners)
    end
    write_home()
    write_section_index(lessons, owners)
    write_search_index(search)
    missing_sections = setdiff(1:408, keys(owners))
    isempty(missing_sections) || @warn "Sections without a heading" missing_sections
    println("Generated $(length(lessons)) lessons, $(length(search)) search entries, $(length(owners)) sections")
end

generate()
