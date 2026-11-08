include("generate.jl")

using Franklin

cd(SITE) do
    Franklin.optimize(minify = false, prerender = false)
end
