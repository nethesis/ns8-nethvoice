---
title: Variables reference
nav_order: 3
---

# Variables reference 
{: .no_toc }

- TOC
{:toc}

## Data types

- The `boolean` type is represented by the empty string for _FALSE_ and "1" for _TRUE_
- The `integer` type is the zero or any positive integer
- The `string` type is for any other string

## Indexed variables

Some variables are marked as _indexed_. That means their scope actual name ends with a `_N` suffix, where N is an integer. 

For instance the *account_username* variable is an indexed variable, so in the scope it becomes `account_username_1` or `account_username_2` etc.

## Read only access

Some variables are marked as _read-only_. Tancredi does not enforce any access control: it only means that those variables are not designed to be modified by the administrative API. 

## Variables list

{% assign sorted_vars = site.data.variables | sort:'name' %}
{% for var in sorted_vars %}

### {{ var.name }}
{: .no_toc }

{% if var.access == "ro" %}
_Read-only access_
{% endif %}

{% if var.index %}
Indexed by _{{ var.index }}_
{% endif %}

{{ var.description | markdownify }}

{% if var.domain %}
{% capture datatype %}`{{ var.datatype }}` - {{ var.domain }}{% endcapture %}
{% else %}
{% capture datatype %}`{{ var.datatype }}`{% endcapture %}
{% endif %}
{{ datatype | markdownify }}

----

{% endfor %}

## Line key types

{% assign sorted_vars = site.data.linekeys | sort:'type' %}
Type | Description | Value | Label
--- | --- | --- | ---
{% for var in sorted_vars %}`{{ var.type | trim }}` | {{ var.description }} | {{ var.value }} | {{ var.label }}
{% endfor %}


## Soft key types

{% assign sorted_vars = site.data.softkeys | sort:'type' %}
Type | Description | Value | Label
--- | --- | --- | ---
{% for var in sorted_vars %}`{{ var.type | trim }}` | {{ var.description }} | {{ var.value }} | {{ var.label }}
{% endfor %}