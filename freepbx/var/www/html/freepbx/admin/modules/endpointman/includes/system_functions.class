<?php

class epm_system {
    /**
     * Fixes the display are special strings so we can visible see them instead of them being transformed
     * @param string $contents a string of course
     * @return string fixed string
     */
    function display_htmlspecialchars($contents) {
        $contents = str_replace("&amp;", "&amp;amp;", $contents);
        $contents = str_replace("&lt;", "&amp;lt;", $contents);
        $contents = str_replace("&gt;", "&amp;gt;", $contents);
        $contents = str_replace("&quot;", "&amp;quot;", $contents);
        $contents = str_replace("&#039;", "&amp;#039;", $contents);
        return($contents);
    }
    /**
     * Does a TFTP Check by connecting to $host looking for $filename
     * @author http://www.php.net/manual/en/function.socket-create.php#43057
     * @param string $host
     * @param string $filename
     * @return mixed file contents 
     */
    function tftp_fetch($host, $filename) {
        //first off let's check if this is installed or disabled
        $socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);

        // create the request packet
        $packet = chr(0) . chr(1) . $filename . chr(0) . 'octet' . chr(0);
        // UDP is connectionless, so we just send on it.
        socket_sendto($socket, $packet, strlen($packet), 0x100, $host, 69);

        $buffer = '';
        $port = '';
        $ret = '';
        $time = time();
        do {
            $new_time = time() - $time;
            if ($new_time > 5) {
                break;
            }
            // $buffer and $port both come back with information for the ack
            // 516 = 4 bytes for the header + 512 bytes of data
            socket_recvfrom($socket, $buffer, 516, 0, $host, $port);

            // add the block number from the data packet to the ack packet
            $packet = chr(0) . chr(4) . substr($buffer, 2, 2);
            // send ack
            socket_sendto($socket, $packet, strlen($packet), 0, $host, $port);

            // append the data to the return variable
            // for large files this function should take a file handle as an arg
            $ret .= substr($buffer, 4);
        } while (strlen($buffer) == 516);  // the first non-full packet is the last.
        return $ret;
    }
    
    /**
     * The RecursiveIteratorIterator must be told to provide children (files and subdirectories) before parents with its CHILD_FIRST constant.
     * Using RecursiveIteratorIterator is the only way PHP is able to see hidden files.
     * @author http://www.webcheatsheet.com/PHP/working_with_directories.php
     * @param string $dir Full Directory path to delete
     * @version 2.11
     */
    function rmrf($dir) {
        if (file_exists($dir)) {
            $iterator = new RecursiveDirectoryIterator($dir);
            foreach (new RecursiveIteratorIterator($iterator, RecursiveIteratorIterator::CHILD_FIRST) as $file) {
                if ($file->isDir()) {
                    @rmdir($file->getPathname());
                } else {
                    @unlink($file->getPathname());
                }
            }
            //Remove parent path as the last step
            @rmdir($dir);
        }
    }
    
    /**
    * Uses which to find executables that asterisk can run/use
    * @version 2.11
    * @param string $exec Executable to find
    * @package epm_system
    */
    function find_exec($exec) {
        $o = exec('which '.$exec);
        if($o) {
            if(file_exists($o) && is_executable($o)) {
                return($o);
            } else {
                return('');
            }
        } else {
            return('');
        }
    }
    
    /**
    * Downloads a file and places it in the destination defined
    * @version 2.11
    * @param string $url_file URL of File
    * @param string $destination_file Destination of file
    * @package epm_system
    */
    function download_file($url_file, $destination_file) {
        //Determine if file_get_contents_url exists which is the default FreePBX Standard for downloading straight files
        if(function_exists('file_get_contents_url')) {
            $contents = file_get_contents_url($url_file);
        } else {
            //I really hope we NEVER get here.
            $contents = file_get_contents($url_file);
            if (!preg_match('/200/', $http_response_header[0])) {
                $this->error['download_file'] = "Unknown Error in Download_file";
                return false;
            }
        }
        //If contents are emtpy then we failed. Or something is wrong
        if(!empty($contents)) {
            $dirname = dirname($destination_file);
            if (!file_exists($dirname)) {
                mkdir($dirname);
            }
            if (!is_writable($dirname)) {
                $this->error['download_file'] = "Directory '" . $dirname . "' is not writable! Unable to download files";
                return false;
            }
            file_put_contents($destination_file, $contents);
            //check file placement
            if (!file_exists($destination_file)) {
                $this->error['download_file'] = "File Doesn't Exist in '" . $dirname . "'. Unable to download files";
                return false;
            }
            return true;
        } else {
            $this->error['download_file'] = "Contents of Remote file are blank! URL:".$url_file;
            return false;
        }
    }
    
    /**
    * Downloads a file and places it in the destination defined with progress
    * @version 2.11
    * @param string $url_file URL of File
    * @param string $destination_file Destination of file
    * @package epm_system
    */
    function download_file_with_progress_bar($url_file, $destination_file) {
        set_time_limit(0);
        $headers = get_headers($url_file, 1);
        $size = $headers['Content-Length'];

        if (preg_match('/200/', $headers[0])) {
            $pid = $this->run_in_background("wget " . $url_file . " -O " . $destination_file);

            while ($this->is_process_running($pid)) {

                $out = 100 * round(filesize($destination_file) / $size, 2);
                echo '<script type="text/javascript">document.getElementById(\'DivExample\').innerHTML="%' . $out . '";</script>';

                usleep('500');
                ob_end_flush();
                //ob_flush();
                flush();
                ob_start();
                

                clearstatcache(); // make sure PHP actually checks dest. file size 
            }
            return true;
        } else {
            return false;
        }
    }
    
    /**
     * Taken from http://www.php.net/manual/en/function.array-search.php#69232
     * search haystack for needle and return an array of the key path, FALSE otherwise.
     * if NeedleKey is given, return only for this key mixed ArraySearchRecursive(mixed Needle,array Haystack[,NeedleKey[,bool Strict[,array Path]]])
     * @author ob (at) babcom (dot) biz
     * @param mixed $Needle
     * @param array $Haystack
     * @param mixed $NeedleKey
     * @param bool $Strict
     * @param array $Path
     * @return array
     * @package epm_system
     */
    function arraysearchrecursive($Needle, $Haystack, $NeedleKey="", $Strict=false, $Path=array()) {
        if (!is_array($Haystack))
            return false;
        foreach ($Haystack as $Key => $Val) {
            if (is_array($Val) &&
                    $SubPath = $this->arraysearchrecursive($Needle, $Val, $NeedleKey, $Strict, $Path)) {
                $Path = array_merge($Path, Array($Key), $SubPath);
                return $Path;
            } elseif ((!$Strict && $Val == $Needle &&
                    $Key == (strlen($NeedleKey) > 0 ? $NeedleKey : $Key)) ||
                    ($Strict && $Val === $Needle &&
                    $Key == (strlen($NeedleKey) > 0 ? $NeedleKey : $Key))) {
                $Path[] = $Key;
                return $Path;
            }
        }
        return false;
    }

    /**
    * Send process to run in background
    * @version 2.11
    * @param string $command the command to run
    * @param integer $Priority the Priority of the command to run
    * @return int $PID process id
    * @package epm_system
    */
    function run_in_background($Command, $Priority = 0) {
        return($Priority ? shell_exec("nohup nice -n $Priority $Command 2> /dev/null & echo $!") : shell_exec("nohup $Command > /dev/null 2> /dev/null & echo $!"));
    }

    /**
    * Check if process is running in background
    * @version 2.11
    * @param string $PID proccess ID
    * @return bool true or false
    * @package epm_system
    */
    function is_process_running($PID) {
        exec("ps $PID", $ProcessState);
        return(count($ProcessState) >= 2);
    }
}