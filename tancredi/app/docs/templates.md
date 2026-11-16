---
nav_order: 2
---

# Templates
{: .no_toc }

When a phone is powered on it asks one or more files containing its
configuration from an HTTP server. Tancredi generates the requested file
dynamically, by interpolating a template file with the values of the phone
configuration variables.

- TOC
{:toc}

## Custom templates

Templates are processed by [Twig 3](https://twig.symfony.com/) and are stored
under the `templates/` directory in `ro_dir`, typically `data/templates/`.

The system administrator can override any shipped template by creating a file
with the same name under `templates-custom/` in `rw_dir`.

At render time Tancredi loads templates in this order:

1. `rw_dir/templates-custom/`
2. `ro_dir/templates/`

## Template/Request binding: the `patterns.d` directory

When a phone requests a file, Tancredi establishes what template has to be
interpolated to build the response by looking at the `.ini` files under the
`patterns.d` directories.

At match time Tancredi loads request rules in this order:

1. `rw_dir/patterns.d/`
1. `ro_dir/patterns.d/`

If a writable pattern file has the same name as a shipped one, the writable
file replaces it. Because the first matching rule wins, rules from `rw_dir`
can both add new matches and override shipped matches.

Each `.ini` file in that directory defines one or more request matching rules.
The rule definition has the following lines:

1. The `[rule identifier]` section

1. The `pattern = ` line is a regular expression matching the requested file
name. The first matching rule wins.

1. The `scopeid = ` line is the identifier of the returned scope. Variable
values also depend on inherited parent scopes and on runtime variables.

1. The `template = ` line is the name of a variable containing the template
file name. This lets a model or a single phone select a different template for
the same request pattern.

1. The `content_type = ` line sets the HTTP response MIME type and must match
the rendered payload format.

This is an example of `.ini` file inside `patterns.d`:

```ini
[yealink-MAC-1]
pattern = "(00)(15)(65)([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})\.cfg"
scopeid = "$1-$2-$3-$4-$5-$6"
template = "tmpl_phone"
content_type = "text/plain; charset=utf-8"
```

## Variable value inheritance

Variables values are assigned inside a scope. A scope is stored in an `.ini`
file under the `scopes` directory. A scope can have a parent scope from which
variables are inherited.

A variable value is generally defined by the *most specific scope rule*. The
value is assigned by looking to the parent scopes in the following order:

1. defaults
2. model
3. phone

A variable value is **inherited** from the parent scope to the specific one and
is **overridden** by child scopes. In other words, if the child scope does not
define a variable the value from the parent is considered.

For example:

1. the *defaults* scope has the following vars: `{v0: a, v1: b, v2: c}`,
2. the *model* scope with id "yealink" has: `{v1: q, v3: p}`
3. the *phone* scope with id "00-00-00-00-00-00" has: `{v2: x, v4: y}`

When a template is expanded for the phone with MAC "00-00-00-00-00-00" the
variables context is: `{v0: a, v1: q, v2: x, v3: p, v4: y}`.

## External data sources for run-time variables

Sometimes it is useful to retrieve a variable value from an external data
source. It is possible to plug in a filter that adds or modifies the variables
passed to the Twig template context.

To add one or more runtime filter classes (for example `SampleFilter`), set
`runtime_filters` in the configuration file:

```ini
runtime_filters = "SampleFilter"
```

Multiple filters can be configured as a comma-separated list.

The file `src/Entity/SampleFilter.php` provides an example filter
implementation.

Each filter class is instantiated immediately before template rendering, after
scope inheritance has been resolved and before Twig expands the selected
template. The filter receives the full scope array and returns the modified
array.

Runtime filters can add, remove or modify any variable in the render context.

Filter classes can access the Tancredi configuration. For example, add the
following line to the configuration file:

```ini
samplefilter_format = "d M Y H:i:s"
```

The `SampleFilter` class can access it through the `$config` array.
