# Estonian Study Notebook

Original Estonian grammar notes and exercises in 40 lessons, published as a static site with [Franklin.jl](https://franklinjl.org/).

Edit the lessons in `notebook/`. Pages in `site/` are generated from them by `scripts/generate.jl`.

## Build and preview

```bash
julia --project=. -e 'using Pkg; Pkg.instantiate()'
```

```bash
julia --project=. -e 'include("scripts/generate.jl"); using Franklin; cd(SITE) do; serve(); end'
```

Pushing to `main` builds and deploys the site to GitHub Pages.
