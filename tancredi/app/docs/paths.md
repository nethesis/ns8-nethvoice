---
parent: Tancredi API v1
---

# Paths

1. TOC
{:toc}

## Data model entities

### phones/

* [GET /phones]({{ "/paths/phonesGet" | relative_url }}) return the collection of configured phones
* [GET /phones/{mac}]({{ "/paths/phonesMacGet" | relative_url }}) return the phone instance with the given `mac` address
* [POST /phones]({{ "/paths/phonesPost" | relative_url }}) add a phone to inventory specifying mac, model and variables
* [PATCH /phones/{mac}]({{ "/paths/phonesMacPatch" | relative_url }}) change `variables` of phone with given `mac`
* [DELETE /phones/{mac}]({{ "/paths/phonesMacDelete" | relative_url }}) delete the phone with given `mac` from inventory
* [POST /phones/{mac}/tok1]({{ "/paths/phonesTok1Post" | relative_url }}) rotate the first-access token for the phone

### models/

* [GET /models]({{ "/paths/modelsGet" | relative_url }}) return the phone models collection
* [GET /models/{name}]({{ "/paths/modelsNameGet" | relative_url }}) return the model with given `name` (e.g. `snom720`)
* [POST /models]({{ "/paths/modelsPost" | relative_url }}) add a new model instance name, display_name, variables
* [PATCH /models/{name}]({{ "/paths/modelsNamePatch" | relative_url }}) change `variables` and other properties of model `name`
* [DELETE /models/{name}]({{ "/paths/modelsNameDelete" | relative_url }}) delete model `name` (if not used, if possible)

### defaults/

* [GET /defaults]({{ "/paths/defaultsGet" | relative_url }}) return the default values for known variables
* [PATCH /defaults]({{ "/paths/defaultsPatch" | relative_url }}) change the default value of some variables

### macvendors/

* [GET /macvendors]({{ "/paths/macvendorsGet" | relative_url }}) return list of MAC prefixes associated with vendors

## Assets management

### backgrounds/

* [GET /backgrounds]({{ "/paths/backgroundsGet" | relative_url }}) list of available background files
* [POST /backgrounds]({{ "/paths/backgroundsPost" | relative_url }}) upload a background file
* [DELETE /backgrounds/{file}]({{ "/paths/backgroundsDelete" | relative_url }}) delete a background file

### firmware/

* [GET /firmware]({{ "/paths/firmwareGet" | relative_url }}) list of available firmware files
* [POST /firmware]({{ "/paths/firmwarePost" | relative_url }}) upload a firmware file
* [DELETE /firmware/{file}]({{ "/paths/firmwareDelete" | relative_url }}) delete a firmware file

### ringtones/

* [GET /ringtones]({{ "/paths/ringtonesGet" | relative_url }}) list of available ringtone files
* [POST /ringtones]({{ "/paths/ringtonesPost" | relative_url }}) upload a ringtone file
* [DELETE /ringtones/{file}]({{ "/paths/ringtonesDelete" | relative_url }}) delete a ringtone file

### screensavers/

* [GET /screensavers]({{ "/paths/screensaversGet" | relative_url }}) list of available screensaver files
* [POST /screensavers]({{ "/paths/screensaversPost" | relative_url }}) upload a screensaver file
* [DELETE /screensavers/{file}]({{ "/paths/screensaversDelete" | relative_url }}) delete a screensaver file
