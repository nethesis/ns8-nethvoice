=========================
Google TTS FreePBX Module
=========================

This FreePBX module allows to create system recordings using Google Cloud Text to Speech service https://cloud.google.com/text-to-speech/

At the moment it supports 56 voices, in 14 languages. Both standard and Wavenet voices are available

Configuration
=============

Just insert your Google API key https://cloud.google.com/docs/authentication/api-keys#creating_an_api_key and enjoy

Using this module functions
==========================

* googletts_getAvailableVoices( [LANG] )

  get list of available voices.

  LANG: language code. Can be a string identifying the language ( de | en | es | fr | it | ja | ko | nl | pt | sv | tr ) or an array like the one returned by Soundlang modules: Soundlang()->getLanguages()



* googletts_tts( TEXT [,LANG] [,VOICE] )

  Use TTS API to get an audio file for the message. Return a checksum identifyng the message.

  TEXT: text to read using TTS
  LANG: language code. A string identifying the language ( de | en | es | fr | it | ja | ko | nl | pt | sv | tr )
  VOICE: string. A voice available in google TTS, like 'de-DE-Wavenet-A'. "Wavenet" voices have better quality over "Standard".


* googletts_get_unsaved_audio(CHECKSUM)

  return base 64 encoded audio.

  CHECKSUM: string as returned by googletts_tts()


* googletts_save_recording(CHECKSUM,LANG,NAME,DESCRIPTION)

  save recording as FreePBX system recording, to allow to be used by other modules like Announcements, IVRs, ...

  CHECKSUM: string as returned by googletts_tts()
  LANG: language code. A string identifying the language, like "en" or "it"
  NAME: a string, it will be the name of the recording in System Recording module
  DESCRIPTION: a string, it will be the description of the recording in System Recording module


FAQ
===

* Can I use it without API Key?

No

* Can I use a service account instead of an API Key?

No

* Does this module support engines different than Google Cloud Text to Speech?

No

* Does this project have been made with or by Google?

No

* Are you related in any way with Google

No

* Should I report bugs and feature requests to Google or FreePBX?

No, use https://community.nethserver.org instead

License
=======

GPL 2
