#!/usr/bin/env php

<?php
include "/etc/freepbx.conf";
// Include Speech To Text Google libraries
require_once '/usr/src/google_speech_php/vendor/autoload.php';
// Include Speech to Text libraies
use Google\Cloud\Speech\V1\SpeechClient;
use Google\Cloud\Speech\V1\RecognitionAudio;
use Google\Cloud\Speech\V1\RecognitionConfig;
use Google\Cloud\Speech\V1\RecognitionConfig\AudioEncoding;

define('SAMPLE_RATE_HTZ', 16000);
$default_language = \FreePBX::Soundlang()->getLanguage();
$language = !empty($default_language) ? $default_language . '_' . strtoupper($default_language) : 'it_IT';

# create a temporary directory and cd to it
$tempDir = trim(shell_exec('mktemp -d'));
$tempStdinFile = $tempDir . "/stream.org";
# dump the stream to a temporary file
$resSTDIN=fopen("php://stdin","r");
$out = fopen($tempStdinFile, 'w');

# dump the stream to a temporary file
while (!feof($resSTDIN)){
	fwrite($out, fread($resSTDIN, 8192));
}
fclose($resSTDIN);
fclose($out);

# get the boundary
$shellCmd = "grep \"boundary=\" " . $tempStdinFile . " | cut -d'\"' -f 2";
$boundary = trim(shell_exec($shellCmd));
/*
cut the file into parts
stream.part - header before the boundary
stream.part1 - header after the bounday
stream.part2 - body of the message
stream.part3 - attachment in base64 (WAV file)
stream.part4 - footer of the message
*/
$shellCmd = "awk '/'" . $boundary . "'/{i++}{print > \"" . $tempDir . "/stream.part\"i}' " . $tempStdinFile;
$awkReturn = trim(shell_exec($shellCmd));

# if mail is having no audio attachment (plain text)
$shellCmd = "cat " . $tempDir . "/stream.part1 | grep 'plain'";
$plainText = trim(shell_exec($shellCmd));

// with audio file
if ($plainText == "") {
	# cut the attachment into parts
	# stream.part3.head - header of attachment
	$shellCmd = "sed '7,\$d' " . $tempDir . "/stream.part3 > " . $tempDir . "/stream.part3.wav.head";
	$cmdReturn = trim(shell_exec($shellCmd));

	# stream.part3.wav.base64 - wav file of attachment (encoded base64)
	$shellCmd = "sed '1,6d' " . $tempDir . "/stream.part3 > " . $tempDir . "/stream.part3.wav.base64";
	$cmdReturn = trim(shell_exec($shellCmd));

	# convert the base64 file to a wav file
	$shellCmd = "dos2unix -o " . $tempDir . "/stream.part3.wav.base64";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "base64 -di " . $tempDir . "/stream.part3.wav.base64 > " . $tempDir . "/stream.part3.wav";
	$cmdReturn = trim(shell_exec($shellCmd));

	# convert wave file (GSM encoded or not) to PCM wav file
	$shellCmd = "sox " . $tempDir . "/stream.part3.wav " . $tempDir . "/stream.part3-pcm.wav";
	$cmdReturn = trim(shell_exec($shellCmd));
	/*
	convert PCM wav file to mp3 file
	-b 24 is using CBR, giving better compatibility on smartphones (you can use -b 32 to increase quality)
	-V 2 is using VBR, a good compromise between quality and size for voice audio files
	*/
	$shellCmd = "lame -m m -b 24 " . $tempDir . "/stream.part3-pcm.wav " . $tempDir . "/stream.part3.mp3";
	$cmdReturn = trim(shell_exec($shellCmd));

	# convert back mp3 to base64 file
	$shellCmd = "base64 " . $tempDir . "/stream.part3.mp3 > " . $tempDir . "/stream.part3.mp3.base64";
	$cmdReturn = trim(shell_exec($shellCmd));
	/*
	generate the new mp3 attachment header
	change Type: audio/x-wav or audio/x-WAV to Type: audio/mpeg
	change name="msg----.wav" or name="msg----.WAV" to name="msg----.mp3"
	*/
	$shellCmd = "sed 's/x-[wW][aA][vV]/mpeg/g' " . $tempDir . "/stream.part3.wav.head | sed 's/.[wW][aA][vV]/.mp3/g' > " . $tempDir . "/stream.part3.mp3.head";
	$cmdReturn = trim(shell_exec($shellCmd));

	# convert wav file to flac compatible format for Google speech recognition
	$shellCmd = "sox " . $tempDir . "/stream.part3.wav -r 16000 -b 16 -c 1 " . $tempDir . "/audio.flac lowpass -2 2500";
	$cmdReturn = trim(shell_exec($shellCmd));

	# [START speech_transcribe_sync]
	$transcript = "";
	$confidence = "";
	try {
            // get file into a string
            $content = file_get_contents($tempDir . "/audio.flac");

            // set string as audio content
            $audio = (new RecognitionAudio())
                ->setContent($content);

            // set config
            $config = (new RecognitionConfig())
                ->setEncoding(AudioEncoding::FLAC)
                ->setSampleRateHertz(SAMPLE_RATE_HTZ)
                ->setLanguageCode($language);

            // create the speech client
            $client = new SpeechClient(['credentials' => '/home/asterisk/google-auth.json']);

            // create the asyncronous recognize operation
            $operation = $client->longRunningRecognize($config, $audio);
            $operation->pollUntilComplete();

            $transcript = "no transcript";
            $confidence = "0% confidence";

            if ($operation->operationSucceeded()) {
                $response = $operation->getResult();
                foreach ($response->getResults() as $resp) {
                    foreach ($resp->getAlternatives() as $alternative) {
                        $transcript = $alternative->getTranscript();
                        $confidence = $alternative->getConfidence();
                    }
                }
                $client->close();
            }
        } catch (Exception $e) {
            error_log($e->getMessage());
        }
	# [END speech_transcribe_sync]

	# generate first part of mail body, converting it to LF only
	$shellCmd = "mv " . $tempDir . "/stream.part " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "cat " . $tempDir . "/stream.part1 >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	#delete last line
	$shellCmd = "sed '\$d' < " . $tempDir . "/stream.part2 >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));

	# beginning of transcription section
	$shellCmd = "echo \"---Transcription:\" >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "echo \" . $transcript . \" >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "echo \"( " . round($confidence, 2, PHP_ROUND_HALF_UP)*100 . "% confidence )\" >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	#get two blank lines
	$shellCmd = "tail -2 " . $tempDir . "/stream.part2 >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	# end of message body
	//
	$shellCmd = "cat " . $tempDir . "/stream.part3.mp3.head >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "dos2unix -o " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));

	# append base64 mp3 to mail body, keeping CRLF
	$shellCmd = "unix2dos -o " . $tempDir . "/stream.part3.mp3.base64";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "cat " . $tempDir . "/stream.part3.mp3.base64 >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));

	# append end of mail body, converting it to LF only
	$shellCmd = "echo \"\" >> " . $tempDir . "/stream.tmp";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "echo \"\" >> " . $tempDir . "/stream.tmp";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "cat " . $tempDir . "/stream.part4 >> " . $tempDir . "/stream.tmp";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "dos2unix -o " . $tempDir . "/stream.tmp";
	$cmdReturn = trim(shell_exec($shellCmd));
	//
	$shellCmd = "cat " . $tempDir . "/stream.tmp >> " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));

// without audio file
} else {
	$shellCmd = "cat " . $tempDir . "/stream.org > " . $tempDir . "/stream.new";
	$cmdReturn = trim(shell_exec($shellCmd));
}
# send the mail thru sendmail
$shellCmd = "cat " . $tempDir . "/stream.new | sendmail -t";
$cmdReturn = trim(shell_exec($shellCmd));

# remove all temporary files and temporary directory
$shellCmd = "rm -rf " . $tempDir;
$cmdReturn = trim(shell_exec($shellCmd));
