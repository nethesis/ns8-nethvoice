<?PHP

/**
 * Base Class for Provisioner
 *
 * @author Darren Schreiber & Andrew Nagy & Jort Bloem
 * @license MPL / GPLv2 / LGPL
 * @package Provisioner
 *
 */
foreach (explode(" ", "NONE DEPTH STATE_MISMATCH CTRL_CHAR SYNTAX UTF8") AS $key => $value) {
    $value = "JSON_ERROR_$value";
    if (!defined($value))
        define($value, $key);
}
if (!function_exists('json_last_error')) {

    function json_last_error() {
        return JSON_ERROR_NONE;
    }

}

abstract class endpoint_base {

    public $modules_path = "endpoint/";
    public $root_dir = "";  //need to define the root directory for the location of the library (/var/www/html/)
    public $brand_name = "undefined";   //Brand Name
    public $family_line = "undefined";  //Family Line
    public $model = "undefined";        // Model of phone, must match the model name inside of the famil_data.json file in each family folder.
    public $config_files_override;  //Array list of config files to override, data being the contents, key being the name of said file
    public $settings = array();
    public $debug = FALSE;  //Enable or disable debug
    public $debug_return = array(); //Debug fill. I question if this is needed, or perhaps remove above line, seems redudant to have both
    public $replacement_array = array(); //Used for phpunit testing, key is {$var} value is the replacement.
    public $mac;    // Device mac address, should this be in settings?
    public $lower_mac;    // Device mac address, should this be in settings?
    public $timezone = array();       // Global timezone array
    public $DateTimeZone;   // timezone, as a DateTimezone object, much more flexible than just an offset and name.
    public $engine;   //Can be asterisk or freeswitch. This is for the reboot commands.
    public $engine_location = ""; //Location of the executable for said engine above
    public $system;   //unix or windows or bsd. etc
    public $directory_structure = array(); //Directory structure to create as an array
    public $protected_files = array(); //array list of file to NOT over-write on every config file build. They are protected.
    public $copy_files = array();  //array of files or directories to copy. Directories will be recursive
    protected $use_system_dst = TRUE; //Use System DST correction if detected
    protected $en_htmlspecialchars = TRUE; //Enable or Disable PHP's htmlspecialchars() function for variables
    protected $server_type = 'file';  //Can be file or dynamic
    protected $provisioning_type = 'tftp';  //can be tftp,http,ftp ??
    protected $enable_encryption = FALSE;  //Enable file encryption
    protected $provisioning_path = "";                  //Path to provisioner, used in http/https/ftp/tftp
    protected $dynamic_mapping;  // e.g. ARRAY('thisfile.htm'=>'# Intentionally left blank','thatfile$mac.htm'=>array('thisfile.htm','thatfile$mac.htm'));
    // files not in this array are passed through untouched. Strings are returned as is. For arrays, generate_file is called for each entry, and they are combined.
    protected $config_file_replacements = array();
    protected $config_files = array();
    protected $brand_data;    //Brand Data file in array form
    protected $family_data;   //family data file in array form
    protected $model_data;    //model data from family data in array form
    protected $template_data; //Merged template files for specified model in array form
    protected $max_lines = array();   //Max lines from said model.
    private $server_type_list = array('file', 'dynamic');  // acceptable values for $server_type
    private $default_server_type = 'file';  // if server_type is invalid
    private $provisioning_type_list = array('tftp', 'http', 'ftp'); //acceptable values for $provisioning_type
    private $default_provisioning_type = 'tftp'; // if provisioning_type is invalid
    private $initialized = FALSE;   //Initialized data or not.

    /* $mapfields is an array of "setting"=>array(
      "possibility1"=>"result1",
      "posibility2"=>"result2",
      "default"=>"defaultresult");
      in prepare_for_generateconfig, all of the keys in this array are gone
      through. If $this->setting (in the above example) is set,
      $this->setting is set to $mapfields["setting"][$this->setting], or if
      it doesn't exist, it is set to $mapfields["setting"]["default"]
     */
    public $mapfields = array(); // override in children.

    function __construct() {
        $this->root_dir = empty($this->root_dir) ? dirname(dirname(__FILE__)) . "/" : $this->root_dir;
    }

    /*     * *PUBLIC FUNCTIONS** */
    /* These can be called from outside the class */

    /**
     * Generate one config file. Most settings are taken from $this.
     * This is a good thing to overide.
     * if you do, you can do a first cut by calling
     *    $result=parent::generate_file, then tweaking the result,
     *    or if ($sourcefile=..) {} else {return parent::generate_file}
     *
     * Note that, if you use dynamic a server type, $filename refers to the
     *    FINAL output file, not the piece that we're generating. In general,
     *    $filename is probably unlikely to be used.
     *
     * @author Jort Bloem
     */
    public function generate_file($filename, $extradata, $ignoredynamicmapping=FALSE, $prepare=FALSE) {
        if ($prepare) {
            $this->prepare_for_generateconfig();
        }
        # Note: server_type='dynamic' is ignored if ignoredynamicmapping, if there is no $this->dynamic_mapping, or that is not an array.
        if (($ignoredynamicmapping) || ($this->server_type != 'dynamic') || (!is_array($this->dynamic_mapping)) || (!array_key_exists($extradata, $this->dynamic_mapping))) {
            $data = $this->open_config_file($extradata);
            return $this->parse_config_file($data);
        } elseif (!is_array($this->dynamic_mapping[$extradata])) {
            return $this->dynamic_mapping[$extradata];
        } else {
            $data = "";
            foreach ($this->dynamic_mapping[$extradata] AS $recurseextradata) {
                $data.=$this->generate_file($filename, $recurseextradata, TRUE);
            }
            return $data;
        }
    }

    /**
     * generate_config() - this shouldn't need to be overridden.
     * @author Jort Bloem
     */
    public function generate_all_files() {
        $this->prepare_for_generateconfig();
        $output = array();
        foreach ($this->config_files() AS $filename => $sourcefile) {
            $output[$filename] = $this->generate_file($filename, $sourcefile, FALSE, FALSE);
        }
        return $output;
    }

    /**
     *
     */
    public function reboot() {

    }

    public function __toString() {

    }

    public function __invoke($x) {

    }

    /*     * *INTERNAL FUNCTIONS** */
    /* These can only be called from within the parent or child classes */

    /*     * *ALL HOOKS BELOW** */

    /**
     * This is hooked into the middle of the line loop function to allow parsing of variables without having to create a sub foreach or for statement
     * @param String $line The Line number.
     */
    protected function parse_lines_hook($line_data, $line_total) {
        return($line_data);
    }

    /**
     * This generates a list of config files, and the files on which they
     * are based.
     * @author Jort Bloem
     * @return array ($outputfilename=>$sourcefilename,...)
     *      both filenames are strings, sourcefilename may occur more
     *          than once.
     * override this, if you feel so inclined - you probably want to call
     *    $result=parent::config_files() first, then modify $result as you like.
     *
     * You should call prepare_for_generateconfig() before calling this.
     * */
    protected function config_files() {
        foreach (explode(",", $this->family_data['data']['configuration_files']) AS $configfile) {
            $outputfile = str_replace(array_keys($this->config_file_replacements), array_values($this->config_file_replacements), $configfile);
            $result[$outputfile] = $configfile;
        }
        return $result;
    }

    /**
     * Override this to do any configuration testing/sorting/preparing
     * Dont forget to call parent::prepare_for_generateconfig if you
     * do override it.
     * @author Jort Bloem
     * */
    protected function prepare_for_generateconfig() {
        $this->initialize();
        if (!in_array('$mac', $this->config_file_replacements)) {
            $this->config_file_replacements['$mac'] = $this->mac;
        }
        if (!in_array('$lower_mac', $this->config_file_replacements)) {
            $this->config_file_replacements['$lower_mac'] = strtolower($this->mac);
        }
        if (!in_array('$model', $this->config_file_replacements)) {
            $this->config_file_replacements['$model'] = $this->model;
        }
        foreach ($this->mapfields as $fieldname => $map) {
            if (isset($this->settings[$fieldname]) AND (array_key_exists($this->settings[$fieldname], $map))) {
                $this->settings[$fieldname] = $map[$this->settings[$fieldname]];
            } else {
                $this->settings[$fieldname] = $map['default'];
            }
        }
        $this->mapfields = array(); // ensure it only happens once.
    }

    private function setup_languages() {
        return $languages;
    }

    /**
     * Takes the name of a local configuration file and either returns that file from the hard drive as a string or takes the string from the array and returns that as a string
     * @param string $filename Configuration File name
     * @return string Full Configuration File (From Hard Drive or Array)
     * @example
     * <code>
     *  $full_file = $this->open_config_file("local_file.cfg");
     * </code>
     * @author Andrew Nagy
     */
    private function open_config_file($filename) {
        //if there is no configuration file over ridding the default then load up $contents with the file's information, where $key is the name of the default configuration file
        if (!isset($this->config_files_override[$filename])) {
            return file_get_contents($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/" . $filename);
        } else {
            return($this->config_files_override[$filename]);
        }
    }

    /**
     * This will parse configuration values that are either {$variable}, {$variable|default}, {$variable.line.num}, or {$variable.line.num|default}
     * It will determine the line ammount and then run the function to parse lines and then run parse config values (to replace any remaining values)
     * @param string $file_contents full contents of the configuration file
     * @param boolean $keep_unknown Keep Unknown variables as {$variable} instead of erasing them (blanking the space), can be used to parse these variables later
     * @param integer $lines The total number of lines for this model, NULL if defining a model
     * @param integer $specific_line The specific line number to manipulate. If no line number set then assume All Lines
     * @return string Full Contents of the configuration file (After Parsing)
     * @author Andrew Nagy
     */
    private function parse_config_file($file_contents) {
        $file_contents = $this->generate_info($file_contents);

        $file_contents = $this->parse_conditionals($file_contents);
        $file_contents = $this->parse_conditional_model($file_contents);

        $file_contents = $this->parse_lines($file_contents, FALSE);
        $file_contents = $this->parse_loops($file_contents, FALSE);

        $file_contents = $this->replace_static_variables($file_contents);
        $file_contents = $this->parse_config_values($file_contents);

        return $file_contents;
    }

    /**
     * Simple isset/==/!= statetment
     * @param string $file_contents Full Contents of the configuration file
     * @return string Full Contents of the configuration file (After Parsing)
     * @example {if condition="$local_port == '5060'"}{/if}
     * @author Andrew Nagy
     */
    private function parse_conditionals($file_contents) {
        $pattern = "/{if condition=\"(.*?)\"}(.*?){\/if}/si";
        while (preg_match($pattern, $file_contents, $matches)) {
            $function = $matches[1];
            $contents = $matches[2];
            if(preg_match('/isset\(\$(\w*)\)/i',$function,$fmatches)) {
                if(isset($this->settings[$fmatches[1]])) {
                    $file_contents = preg_replace($pattern, $contents, $file_contents, 1);
                }
            } elseif(preg_match('/\$(.*) == \'(.*)\'/i',$function,$fmatches)) {
                if(isset($this->settings[$fmatches[1]]) AND ($this->settings[$fmatches[1]] == $fmatches[2])){
                    $file_contents = preg_replace($pattern, $contents, $file_contents, 1);
                }
            } elseif(preg_match('/\$(.*) != \'(.*)\'/i',$function,$fmatches)) {
                if(isset($this->settings[$fmatches[1]]) AND ($this->settings[$fmatches[1]] != $fmatches[2])){
                    $file_contents = preg_replace($pattern, $contents, $file_contents, 1);
                }
            }
            $file_contents = preg_replace($pattern, "", $file_contents, 1);
        }
        return($file_contents);
    }

    /**
     * Simple Model if then statement, should be called before any parsing!
     * @param string $file_contents Full Contents of the configuration file
     * @return string Full Contents of the configuration file (After Parsing)
     * @example {if model="6757*"}{/if}
     * @author Andrew Nagy
     */
    private function parse_conditional_model($file_contents) {
        $pattern = "/{if model=\"(.*?)\"}(.*?){\/if}/si";
        while (preg_match($pattern, $file_contents, $matches)) {
            //This is exactly like the fnmatch function except it will work on POSIX compliant systems
            //http://php.net/manual/en/function.fnmatch.php
            if (preg_match("#^" . strtr(preg_quote($matches[1], '#'), array('\*' => '.*', '\?' => '.', '\[' => '[', '\]' => ']')) . "$#i", $this->model)) {
                $file_contents = preg_replace($pattern, $matches[2], $file_contents, 1);
            } else {
                $file_contents = preg_replace($pattern, "", $file_contents, 1);
            }
        }
        return($file_contents);
    }

    /**
     * Parse data between {loop_*}{/loop_*}
     * @param string $line_total Total Number of Lines on the specific Phone
     * @param string $file_contents Full Contents of the configuration file
     * @param boolean $keep_unknown Keep Unknown variables as {$variable} instead of erasing them (blanking the space), can be used to parse these variables later
     * @param integer $specific_line The specific line number to manipulate. If no line number set then assume All Lines
     * @return string Full Contents of the configuration file (After Parsing)
     * @example {loop_keys}{/loop_keys}
     * @author Andrew Nagy
     */
    private function parse_loops($file_contents, $keep_unknown=FALSE) {
        //Find line looping data betwen {line_loop}{/line_loop}
        $pattern = "/{loop_(.*?)}(.*?){\/loop_(.*?)}/si";
        while (preg_match($pattern, $file_contents, $matches)) {
            $loop_name = $matches[3];
            $loop_contents = $matches[2];
            //TODO: This should be $this->settings['loop'][$loop_name]
            if (isset($this->settings['loops'][$loop_name])) {
                $count = count($this->settings['loops'][$loop_name]);
                $this->debug("Replacing loop '" . $loop_name . "' " . $count . " times");
                $parsed = "";
                if ($count) {
                    foreach ($this->settings['loops'][$loop_name] as $number => $data) {
                        $data['number'] = $number;
                        $data['count'] = $number;
                        $parsed .= $this->parse_config_values($this->replace_static_variables($loop_contents), $data, FALSE);
                    }
                }
                $file_contents = preg_replace($pattern, $parsed, $file_contents, 1);
            } else {
                $file_contents = preg_replace($pattern, "", $file_contents, 1);
                $this->debug("Blanking loop '" . $loop_name . "'");
            }
        }
        return($file_contents);
    }

    private function find_model($family_data) {
        if (is_array($family_data['data']['model_list'])) {
            $key = $this->arraysearchrecursive($this->model, $family_data, "model");
            if ($key !== FALSE) {
                return($family_data['data']['model_list'][$key[2]]);
            }
        }
        throw new Exception('Could Not find model');
    }

    /**
     * Parse each individual line through use of {$variable.line.num} or {line_loop}{/line_loop}
     * @param string $line_total Total Number of Lines on the specific Phone
     * @param string $file_contents Full Contents of the configuration file
     * @param boolean $keep_unknown Keep Unknown variables as {$variable} instead of erasing them (blanking the space), can be used to parse these variables later
     * @return string Full Contents of the configuration file (After Parsing)
     * @author Andrew Nagy
     */
    private function parse_lines($file_contents, $keep_unknown=FALSE) {
        //Find line looping data betwen {line_loop}{/line_loop}
        $pattern = "/{line_loop}(.*?){\/line_loop}/si";
        while (preg_match($pattern, $file_contents, $matches)) {
            $loop_contents = $matches[1];
            $parsed = "";
            foreach ($this->settings['line'] as $data) {
                $line = $data['line'];
                $data['number'] = $line;
                $data['count'] = $line;
                $line_settings = $this->parse_lines_hook($data, $this->max_lines);
                $parsed .= $this->parse_config_values($this->replace_static_variables($loop_contents, $line_settings), $line_settings, $keep_unknown);
            }
            $file_contents = preg_replace($pattern, $parsed, $file_contents, 1);
        }
        return($file_contents);
    }

    private function merge_files() {
        $template_data_list = $this->model_data['template_data'];

        $template_data = array();
        $template_data_multi = "";

        //Setup defaults from global file
        $template_data_multi = $this->file2json($this->root_dir . $this->modules_path . '/global_template_data.json');
        $template_data_multi = $template_data_multi['template_data']['category'];
        foreach ($template_data_multi as $categories) {
            $subcats = $categories['subcategory'];
            foreach ($subcats as $subs) {
                $items = $subs['item'];
                $template_data = array_merge($template_data, $items);
            }
        }

        //Setup defaults from each template file
        foreach ($template_data_list as $files) {
            if (file_exists($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/" . $files)) {
                $template_data_multi = $this->file2json($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/" . $files);
                $template_data_multi = $template_data_multi['template_data']['category'];
                foreach ($template_data_multi as $categories) {
                    $subcats = $categories['subcategory'];
                    foreach ($subcats as $subs) {
                        $items = $subs['item'];
                        $template_data = array_merge($template_data, $items);
                    }
                }
            } else {
                throw new Exception("Template File: " . $files . " doesnt exist!");
            }
        }


        if (file_exists($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/template_data_custom.json")) {
            $template_data_multi = $this->file2json($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/template_data_custom.json");
            $template_data_multi = $template_data_multi['template_data']['category'];
            foreach ($template_data_multi as $categories) {
                $subcats = $categories['subcategory'];
                foreach ($subcats as $subs) {
                    $items = $subs['item'];
                    $template_data = array_merge($template_data, $items);
                }
            }
        }

        if (file_exists($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/template_data_" . $this->model . "_custom.json")) {
            $template_data_multi = $this->file2json($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/template_data_" . $this->model . "_custom.json");
            $template_data_multi = $template_data_multi['template_data']['category'];
            foreach ($template_data_multi as $categories) {
                $subcats = $categories['subcategory'];
                foreach ($subcats as $subs) {
                    $items = $subs['item'];
                    $template_data = array_merge($template_data, $items);
                }
            }
        }
        return($template_data);
    }

    private function parse_config_values($file_contents, $data=NULL, $keep_unknown=FALSE) {
        //Find all matched variables in the text file between "{$" and "}"
        preg_match_all('/{(\$[^{]+?)[}]/i', $file_contents, $match);
        //Result without brackets (but with the $ variable identifier)
        $no_brackets = array_values(array_unique($match[1]));
        //Result with brackets
        $brackets = array_values(array_unique($match[0]));

        foreach ($no_brackets as $variables) {
            $original_variable = $variables;
            $default_exp = preg_split("/\|/i", str_replace("$", "", $variables));
            $variables = $default_exp[0];
            $default = isset($default_exp[1]) ? $default_exp[1] : null;

            if (is_array($data)) {
                if (isset($data[$variables])) {
                    $data[$variables] = $this->replace_static_variables($data[$variables]);
                    $this->debug("Replacing '{" . $original_variable . "}' with " . $data[$variables]);
                    if (isset($data['line'])) {
                        $l = $data['line'];
                        $this->replacement_array['lines'][$l][$original_variable] = $data[$variables];
                    }
                    $file_contents = str_replace('{' . $original_variable . '}', $data[$variables], $file_contents);
                    continue;
                }
            } else {
                if (isset($this->settings[$variables])) {
                    $this->settings[$variables] = $this->replace_static_variables($this->settings[$variables]);
                    $this->replacement_array['other'][$original_variable] = $this->settings[$variables];
                    $file_contents = str_replace('{' . $original_variable . '}', $this->settings[$variables], $file_contents);
                    continue;
                }
            }

            if (!$keep_unknown) {
                //read default template values here, blank unknowns or arrays (which are blanks anyways)
                $key1 = $this->arraysearchrecursive('$' . $variables, $this->template_data, 'variable');

                $default_hard_value = NULL;

                //Check for looping statements. They are all setup logically the same. Ergo if the first multi-dimensional array has a variable key its not a loop.
                if ($key1['1'] == 'variable') {
                    if (is_array($data)) {
                        $dhv = str_replace('{$count}', $data['line'], $this->template_data[$key1[0]]['default_value']);
                        $dhv = str_replace('{$number}', $data['line'], $dhv);
                    } else {
                        $dhv = $this->template_data[$key1[0]]['default_value'];
                    }
                    $default_hard_value = $this->replace_static_variables($dhv);
                } elseif ($key1['4'] == 'variable') {
                    if (is_array($data)) {
                        $dhv = str_replace('{$count}', $data['line'], $this->template_data[$key1[0]][$key1[1]][$key1[2]][$key1[3]]['default_value']);
                        $dhv = str_replace('{$number}', $data['line'], $dhv);
                    } else {
                        $dhv = $this->template_data[$key1[0]][$key1[1]][$key1[2]][$key1[3]]['default_value'];
                    }
                    $default_hard_value = $this->replace_static_variables($dhv);
                }

                if (isset($default)) {
                    $default = $this->replace_static_variables($default);
                    $file_contents = str_replace('{' . $original_variable . '}', $default, $file_contents);
                    $this->replacement_array['pipes'][$original_variable] = $default;
                    $this->debug('Replacing {' . $original_variable . '} with default piped value of:' . $default);
                } elseif (isset($default_hard_value)) {
                    $default_hard_value = $this->replace_static_variables($default_hard_value);
                    $file_contents = str_replace('{' . $original_variable . '}', $default_hard_value, $file_contents);
                    $this->replacement_array['json'][$original_variable] = $default_hard_value;
                    $this->debug("Replacing {" . $original_variable . "} with default json value of: " . $default_hard_value);
                } else {
                    //do one last replace statice here.
                    $file_contents = str_replace('{' . $original_variable . '}', "", $file_contents);
                    $this->replacement_array['blanks'][$original_variable] = "";
                    $this->debug("Blanking {" . $original_variable . "}");
                }
            }
        }

        return($file_contents);
    }

    /**
     * This will replace statically known variables
     * variables: {$server.ip.*}, {$server.port.*}, {$mac}, {$model}, {$line}, {$ext}, {$displayname}, {$secret}, {$pass}, etc.
     * @param string $contents
     * @param string $specific_line
     * @param boolean $looping
     * @return string
     */
    private function replace_static_variables($contents, $data=NULL) {
        //bad
        global $amp_conf;
        $this->settings['network']['local_port'] = isset($this->settings['network']['local_port']) ? $this->settings['network']['local_port'] : '5060';
    #Nethesis add parameters
    $hostname = exec('/bin/dnsdomainname');
    $hostname = explode ('.',$hostname);
    if(!isset($this->settings['ldap_base'])) $this->settings['ldap_base'] = "dc=phonebook,dc=nh";

        $features = featurecodes_getAllFeaturesDetailed();
        foreach ($features as $feature) {
//CF always ON
        if($feature["featurename"] == "cfon" && $feature["customcode"] == NULL)
                        $cfalwayson = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfon")
                $cfalwayson = $feature["customcode"];

//CF always OFF
        if($feature["featurename"] == "cfoff" && $feature["customcode"] == NULL)
                        $cfalwaysoff = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfoff")
                $cfalwaysoff = $feature["customcode"];
//CF Busy ON
        if($feature["featurename"] == "cfbon" && $feature["customcode"] == NULL)
                        $cfbusyon = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfbon")
                $cfbusyon = $feature["customcode"];
//CF Busy OFF
        if($feature["featurename"] == "cfboff" && $feature["customcode"] == NULL)
                        $cfbusyoff = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfboff")
                $cfbusyoff = $feature["customcode"];
//CF Unvailable On
        if($feature["featurename"] == "cfuon" && $feature["customcode"] == NULL)
                        $cftimeouton = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfuon")
                $cftimeouton = $feature["customcode"];
//CF Unvailable Off
        if($feature["featurename"] == "cfuoff" && $feature["customcode"] == NULL)
                        $cftimeoutoff = $feature["defaultcode"];
        elseif($feature["featurename"] == "cfuoff")
                $cftimeoutoff = $feature["customcode"];
//Call Waiting On
        if($feature["featurename"] == "cwon" && $feature["customcode"] == NULL)
                        $call_waiting_on = $feature["defaultcode"];
        elseif($feature["featurename"] == "cwon")
                $call_waiting_on = $feature["customcode"];
//Call Waiting Off
        if($feature["featurename"] == "cwoff" && $feature["customcode"] == NULL)
                        $call_waiting_off = $feature["defaultcode"];
        elseif($feature["featurename"] == "cwoff")
                $call_waiting_off = $feature["customcode"];
//DND On
        if($feature["featurename"] == "dnd_on" && $feature["customcode"] == NULL)
                        $dndon = $feature["defaultcode"];
        elseif($feature["featurename"] == "dnd_on")
                $dndon = $feature["customcode"];
//DND Off
        if($feature["featurename"] == "dnd_off" && $feature["customcode"] == NULL)
                        $dndoff = $feature["defaultcode"];
        elseif($feature["featurename"] == "dnd_off")
                $dndoff = $feature["customcode"];
//DND Toggle
        if($feature["featurename"] == "dnd_toggle" && $feature["customcode"] == NULL)
                        $dndtoggle = $feature["defaultcode"];
        elseif($feature["featurename"] == "dnd_toggle")
                $dndtoggle = $feature["customcode"];
//Pickup
        if($feature["featurename"] == "pickup" && $feature["customcode"] == NULL)
                        $pickup = $feature["defaultcode"];
        elseif($feature["featurename"] == "pickup")
                $pickup = $feature["customcode"];
//General Pickup
        if($feature["featurename"] == "pickupexten" && $feature["customcode"] == NULL)
                        $pickup_group = $feature["defaultcode"];
        elseif($feature["featurename"] == "pickupexten")
                $pickup_group = $feature["customcode"];
//Personal Voicemail
        if($feature["featurename"] == "myvoicemail" && $feature["customcode"] == NULL)
                        $voicemail_number = $feature["defaultcode"];
        elseif($feature["featurename"] == "myvoicemail")
                $voicemail_number = $feature["customcode"];
        }
//tone
       if(!isset($this->settings['tones_country']) && !isset($this->settings['tones_scheme']) && !isset($this->settings['tones_sangoma']) && !isset($this->settings['tones_gigaset']) && !isset($this->settings['tones_fanvil']))
        switch ($amp_conf['TONEZONE']) {
            case "ao":
                $this->settings['tones_country']="Portugal";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="23";
                $this->settings['tones_gigaset']="PRT";
                $this->settings['tones_fanvil']="32";
                break;
            case "ar":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
            case "au":
                $this->settings['tones_country']="Australia";
                $this->settings['tones_scheme']="AUS";
                $this->settings['tones_sangoma']="1";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="15";
                break;
            case "at":
                $this->settings['tones_country']="Austria";
                $this->settings['tones_scheme']="AUT";
                $this->settings['tones_sangoma']="2";
                $this->settings['tones_gigaset']="AUT";
                $this->settings['tones_fanvil']="22";
                break;
            case "be":
                $this->settings['tones_country']="Belgium";
                $this->settings['tones_scheme']="FRA";
                $this->settings['tones_sangoma']="4";
                $this->settings['tones_gigaset']="FRA";
                $this->settings['tones_fanvil']="0";
                break;
            case "br":
                $this->settings['tones_country']="Brazil";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="3";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="16";
                break;
            case "bg":
                $this->settings['tones_country']="Greece";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="13";
                $this->settings['tones_gigaset']="GRC";
                $this->settings['tones_fanvil']="26";
                break;
            case "cl":
                $this->settings['tones_country']="Chile";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="6";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="20";
                break;
            case "cn":
                $this->settings['tones_country']="China";
                $this->settings['tones_scheme']="CHN";
                $this->settings['tones_sangoma']="5";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="1";
                break;
            case "co":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
            case "cr":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
            case "cz":
                $this->settings['tones_country']="Czech";
                $this->settings['tones_scheme']="AUT";
                $this->settings['tones_sangoma']="7";
                $this->settings['tones_gigaset']="CZE";
                $this->settings['tones_fanvil']="17";
                break;
            case "dk":
                $this->settings['tones_country']="Denmark";
                $this->settings['tones_scheme']="DNK";
                $this->settings['tones_sangoma']="8";
                $this->settings['tones_gigaset']="DNK";
                $this->settings['tones_fanvil']="23";
                break;
            case "ee":
                $this->settings['tones_country']="Lithuania";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="15";
                $this->settings['tones_gigaset']="DEU";
                $this->settings['tones_fanvil']="28";
                break;
            case "fi":
                $this->settings['tones_country']="Finland";
                $this->settings['tones_scheme']="SWE";
                $this->settings['tones_sangoma']="9";
                $this->settings['tones_gigaset']="FIN";
                $this->settings['tones_fanvil']="24";
                break;
            case "fr":
                $this->settings['tones_country']="France";
                $this->settings['tones_scheme']="FRA";
                $this->settings['tones_sangoma']="10";
                $this->settings['tones_gigaset']="FRA";
                $this->settings['tones_fanvil']="25";
                break;
            case "de":
                $this->settings['tones_country']="Germany";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="11";
                $this->settings['tones_gigaset']="DEU";
                $this->settings['tones_fanvil']="2";
                break;
            case "gr":
                $this->settings['tones_country']="Greece";
                $this->settings['tones_scheme']="GRE";
                $this->settings['tones_sangoma']="13";
                $this->settings['tones_gigaset']="GRC";
                $this->settings['tones_fanvil']="26";
                break;
            case "hk":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "hu":
                $this->settings['tones_country']="Hungary";
                $this->settings['tones_scheme']="AUT";
                $this->settings['tones_sangoma']="14";
                $this->settings['tones_gigaset']="AUT";
                $this->settings['tones_fanvil']="27";
                break;
            case "in":
                $this->settings['tones_country']="India";
                $this->settings['tones_scheme']="IND";
                $this->settings['tones_sangoma']="16";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="29";
                break;
            case "ir":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "ie":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "il":
                $this->settings['tones_country']="USA";
                $this->settings['tones_scheme']="USA";
                $this->settings['tones_sangoma']="28";
                $this->settings['tones_gigaset']="USA";
                $this->settings['tones_fanvil']="11";
                break;
            case "it":
                $this->settings['tones_country']="Italy";
                $this->settings['tones_scheme']="ITA";
                $this->settings['tones_sangoma']="17";
                $this->settings['tones_gigaset']="ITA";
                $this->settings['tones_fanvil']="21";
                break;
            case "jp":
                $this->settings['tones_country']="Japan";
                $this->settings['tones_scheme']="JPN";
                $this->settings['tones_sangoma']="18";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="4";
                break;
            case "ke":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "lt":
                $this->settings['tones_country']="Lithuania";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="15";
                $this->settings['tones_gigaset']="DEU";
                $this->settings['tones_fanvil']="28";
                break;
            case "mo":
                $this->settings['tones_country']="Portugal";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="23";
                $this->settings['tones_gigaset']="PRT";
                $this->settings['tones_fanvil']="32";
                break;
            case "my":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "mx":
                $this->settings['tones_country']="Mexico";
                $this->settings['tones_scheme']="MEX";
                $this->settings['tones_sangoma']="19";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="30";
                break;
            case "nl":
                $this->settings['tones_country']="Netherlands";
                $this->settings['tones_scheme']="NLD";
                $this->settings['tones_sangoma']="21";
                $this->settings['tones_gigaset']="NLD";
                $this->settings['tones_fanvil']="5";
                break;
            case "nz":
                $this->settings['tones_country']="New Zealand";
                $this->settings['tones_scheme']="NZL";
                $this->settings['tones_sangoma']="20";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="31";
                break;
            case "no":
                $this->settings['tones_country']="Norway";
                $this->settings['tones_scheme']="NOR";
                $this->settings['tones_sangoma']="22";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="6";
                break;
            case "pk":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "pa":
                $this->settings['tones_country']="USA";
                $this->settings['tones_scheme']="USA";
                $this->settings['tones_sangoma']="28";
                $this->settings['tones_gigaset']="USA";
                $this->settings['tones_fanvil']="11";
                break;
            case "phl":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
            case "pl":
                $this->settings['tones_country']="Germany";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="11";
                $this->settings['tones_gigaset']="POL";
                $this->settings['tones_fanvil']="2";
                break;
            case "pt":
                $this->settings['tones_country']="Portugal";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="23";
                $this->settings['tones_gigaset']="PRT";
                $this->settings['tones_fanvil']="32";
                break;
            case "ro":
                $this->settings['tones_country']="Germany";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="11";
                $this->settings['tones_gigaset']="ROU";
                $this->settings['tones_fanvil']="2";
                break;
            case "ru":
                $this->settings['tones_country']="Russia";
                $this->settings['tones_scheme']="GER";
                $this->settings['tones_sangoma']="27";
                $this->settings['tones_gigaset']="RUS";
                $this->settings['tones_fanvil']="19";
                break;
            case "sg":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "za":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "es":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
            case "se":
                $this->settings['tones_country']="Sweden";
                $this->settings['tones_scheme']="SWE";
                $this->settings['tones_sangoma']="26";
                $this->settings['tones_gigaset']="SWE";
                $this->settings['tones_fanvil']="8";
                break;
            case "ch":
                $this->settings['tones_country']="Switzerland";
                $this->settings['tones_scheme']="SWI";
                $this->settings['tones_sangoma']="25";
                $this->settings['tones_gigaset']="CHE";
                $this->settings['tones_fanvil']="9";
                break;
            case "tw":
                $this->settings['tones_country']="China";
                $this->settings['tones_scheme']="CHN";
                $this->settings['tones_sangoma']="5";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="1";
                break;
            case "tz":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="INT";
                $this->settings['tones_fanvil']="13";
                break;
            case "th":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "tr":
                $this->settings['tones_country']="Greece";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="13";
                $this->settings['tones_gigaset']="GRC";
                $this->settings['tones_fanvil']="26";
                break;
            case "ug":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "uk":
                $this->settings['tones_country']="Great Britain";
                $this->settings['tones_scheme']="GBR";
                $this->settings['tones_sangoma']="12";
                $this->settings['tones_gigaset']="GBR";
                $this->settings['tones_fanvil']="13";
                break;
            case "us":
                $this->settings['tones_country']="USA";
                $this->settings['tones_scheme']="USA";
                $this->settings['tones_sangoma']="28";
                $this->settings['tones_gigaset']="USA";
                $this->settings['tones_fanvil']="11";
                break;
            case "us-old":
                $this->settings['tones_country']="USA";
                $this->settings['tones_scheme']="USA";
                $this->settings['tones_sangoma']="28";
                $this->settings['tones_gigaset']="USA";
                $this->settings['tones_fanvil']="11";
                break;
            case "ve":
                $this->settings['tones_country']="Spain";
                $this->settings['tones_scheme']="ESP";
                $this->settings['tones_sangoma']="24";
                $this->settings['tones_gigaset']="ESP";
                $this->settings['tones_fanvil']="33";
                break;
        }

//timezone & language
        $this->settings['tz'] = FreePBX::create()->Endpointman->configmod->get('tz');


        if(!isset($this->settings['timezone_yealink']) && !isset($this->settings['timezone_snom']) && !isset($this->settings['timezone_sangoma']) && !isset($this->settings['timezone_alcatel'])  && !isset($this->settings['language']) && !isset($this->settings['language_snom']) && !isset($this->settings['language_sangoma']) && !isset($this->settings['language_alcatel']) && !isset($this->settings['language_polycom']) && !isset($this->settings['timezone_gigaset']) && !isset($this->settings['language_gigaset']) && !isset($this->settings['timezone_fanvil']) && !isset($this->settings['language_fanvil']) && !isset($this->settings['language_fanvil2']) && !isset($this->settings['location_fanvil']) && !isset($this->settings['timezone_panasonic']) && !isset($this->settings['language_panasonic'])) 

        switch ($this->settings['tz']) {
### Offset -11
            case 'Pacific/Midway':
            case 'Pacific/Niue':
            case 'Pacific/Pago_Pago':
                $this->settings['timezone_yealink'] = "Samoa";
                $this->settings['timezone_snom'] = "USA2-10";
                $this->settings['timezone_sangoma'] = "105";
                $this->settings['timezone_alcatel'] = "Pacific/Pago_Pago";
                $this->settings['timezone_gigaset'] = "GMT-11.Pacific/Midway";
                $this->settings['timezone_fanvil'] = "-44";
                $this->settings['timezone_name_fanvil'] = "UTC-11";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-660";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset -10
            case 'Pacific/Honolulu':
            case 'Pacific/Rarotonga':
                $this->settings['timezone_yealink'] = "United States-Hawaii-Aleutian";
                $this->settings['timezone_snom'] = "USA-10";
                $this->settings['timezone_sangoma'] = "1";
                $this->settings['timezone_alcatel'] = "Pacific/Honolulu";
                $this->settings['timezone_gigaset'] = "GMT-10.Pacific/Honolulu";
                $this->settings['timezone_fanvil'] = "-40";
                $this->settings['timezone_name_fanvil'] = "UTC-10";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Adak':
                $this->settings['timezone_yealink'] = "United States-Hawaii-Aleutian";
                $this->settings['timezone_snom'] = "USA-10";
                $this->settings['timezone_sangoma'] = "1";
                $this->settings['timezone_alcatel'] = "Pacific/Adak";
                $this->settings['timezone_gigaset'] = "GMT-10.Pacific/Honolulu";
                $this->settings['timezone_fanvil'] = "-40";
                $this->settings['timezone_name_fanvil'] = "UTC-10";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Pacific/Tahiti':
                $this->settings['timezone_yealink'] = "United States-Hawaii-Aleutian";
                $this->settings['timezone_snom'] = "USA-10";
                $this->settings['timezone_sangoma'] = "1";
                $this->settings['timezone_alcatel'] = "Pacific/Honolulu";
                $this->settings['timezone_gigaset'] = "GMT-10.Pacific/Honolulu";
                $this->settings['timezone_fanvil'] = "-40";
                $this->settings['timezone_name_fanvil'] = "UTC-10";
                $this->settings['location_fanvil'] = "0";
                $this->settings['timezone_panasonic'] = "-600";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "French_France";
            break;
### Offset -09:30
            case 'Pacific/Marquesas':
                $this->settings['timezone_yealink'] = "French Polynesia";
                $this->settings['timezone_snom'] = "USA-9";
                $this->settings['timezone_sangoma'] = "3";
                $this->settings['timezone_alcatel'] = "Pacific/Honolulu";
                $this->settings['timezone_gigaset'] = "GMT-10.Pacific/Honolulu";
                $this->settings['timezone_fanvil'] = "-38";
                $this->settings['timezone_name_fanvil'] = "UTC-9:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-570";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
### Offset -9
            case 'America/Anchorage':
            case 'America/Juneau':
            case 'America/Metlakatla':
            case 'America/Nome':
            case 'America/Sitka':
            case 'America/Yakutat':
                $this->settings['timezone_yealink'] = "United States-Alaska Time";
                $this->settings['timezone_snom'] = "USA-9";
                $this->settings['timezone_sangoma'] = "3";
                $this->settings['timezone_alcatel'] = "Pacific/Anchorage";
                $this->settings['timezone_gigaset'] = "GMT-9.America/Anchorage";
                $this->settings['timezone_fanvil'] = "-36";
                $this->settings['timezone_name_fanvil'] = "UTC-9";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-540";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Pacific/Gambier':
                $this->settings['timezone_yealink'] = "United States-Alaska Time";
                $this->settings['timezone_snom'] = "USA-9";
                $this->settings['timezone_sangoma'] = "3";
                $this->settings['timezone_alcatel'] = "Pacific/Anchorage";
                $this->settings['timezone_gigaset'] = "GMT-9.America/Anchorage";
                $this->settings['timezone_fanvil'] = "-36";
                $this->settings['timezone_name_fanvil'] = "UTC-9";
                $this->settings['location_fanvil'] = "0";
                $this->settings['timezone_panasonic'] = "-540";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
### Offset -8
            case 'America/Tijuana':
                $this->settings['timezone_yealink'] = "Mexico(Tijuana,Mexicali)";
                $this->settings['timezone_snom'] = "MEX-8";
                $this->settings['timezone_sangoma'] = "5";
                $this->settings['timezone_alcatel'] = "America/Tijuana";
                $this->settings['timezone_gigaset'] = "GMT-8.America/Tijuana";
                $this->settings['timezone_fanvil'] = "-32";
                $this->settings['timezone_name_fanvil'] = "UTC-8";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-480";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Dawson':
            case 'America/Vancouver':
            case 'America/Whitehorse':
            case 'Pacific/Pitcairn':
                $this->settings['timezone_yealink'] = "Canada(Vancouver,Whitehorse)";
                $this->settings['timezone_snom'] = "USA-8";
                $this->settings['timezone_sangoma'] = "4";
                $this->settings['timezone_alcatel'] = "America/Vancouver";
                $this->settings['timezone_gigaset'] = "GMT-8.America/Los_Angeles";
                $this->settings['timezone_fanvil'] = "-32";
                $this->settings['timezone_name_fanvil'] = "UTC-8";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-480";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Los_Angeles':
                $this->settings['timezone_yealink'] = "United States-Pacific Time";
                $this->settings['timezone_snom'] = "USA-8";
                $this->settings['timezone_sangoma'] = "6";
                $this->settings['timezone_alcatel'] = "America/Los_Angeles";
                $this->settings['timezone_gigaset'] = "GMT-8.America/Los_Angeles";
                $this->settings['timezone_fanvil'] = "-32";
                $this->settings['timezone_name_fanvil'] = "UTC-8";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-480";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset -07:00
            case 'America/Cambridge_Bay':
            case 'America/Creston':
            case 'America/Dawson_Creek':
            case 'America/Edmonton':
            case 'America/Fort_Nelson':
            case 'America/Inuvik':
            case 'America/Yellowknife':
                $this->settings['timezone_yealink'] = "Canada(Edmonton,Calgary)";
                $this->settings['timezone_snom'] = "CAN-7";
                $this->settings['timezone_sangoma'] = "7";
                $this->settings['timezone_alcatel'] = "America/Edmonton";
                $this->settings['timezone_gigaset'] = "GMT-7.America/Denver";
                $this->settings['timezone_fanvil'] = "-28";
                $this->settings['timezone_name_fanvil'] = "";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-420";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Boise':
            case 'America/Denver':
            case 'America/Phoenix':
                $this->settings['timezone_yealink'] = "United States-Mountain Time";
                $this->settings['timezone_snom'] = "USA-7";
                $this->settings['timezone_sangoma'] = "9";
                $this->settings['timezone_alcatel'] = "America/Denver";
                $this->settings['timezone_gigaset'] = "GMT-7.America/Denver";
                $this->settings['timezone_fanvil'] = "-28";
                $this->settings['timezone_name_fanvil'] = "UTC-7";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-420";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Chihuahua':
            case 'America/Hermosillo':
            case 'America/Mazatlan':
            case 'America/Ojinaga':
                $this->settings['timezone_yealink'] = "Mexico(Tijuana,Mexicali)";
                $this->settings['timezone_snom'] = "MEX-7";
                $this->settings['timezone_sangoma'] = "8";
                $this->settings['timezone_alcatel'] = "America/Chihuahua";
                $this->settings['timezone_gigaset'] = "GMT-7.America/Chihuahua";
                $this->settings['timezone_fanvil'] = "-28";
                $this->settings['timezone_name_fanvil'] = "UTC-7";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-420";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
### Offset -06:00
            case 'America/Rainy_River':
            case 'America/Rankin_Inlet':
            case 'America/Regina':
            case 'America/Resolute':
            case 'America/Swift_Current':
            case 'America/Winnipeg':
                $this->settings['timezone_yealink'] = "Canada-Manitoba(Winnipeg)";
                $this->settings['timezone_snom'] = "CAN-6";
                $this->settings['timezone_sangoma'] = "11";
                $this->settings['timezone_alcatel'] = "America/Winnipeg";
                $this->settings['timezone_gigaset'] = "GMT-6.America/Regina";
                $this->settings['timezone_fanvil'] = "-24";
                $this->settings['timezone_name_fanvil'] = "UTC-6";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-360";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Belize':
            case 'America/Chicago':
            case 'America/Indiana/Knox':
            case 'America/Indiana/Tell_City':
            case 'America/North_Dakota/Beulah':
            case 'America/North_Dakota/Center':
            case 'America/North_Dakota/New_Salem':
            case 'America/Menominee':
                $this->settings['timezone_yealink'] = "United States-Central Time";
                $this->settings['timezone_snom'] = "USA-6";
                $this->settings['timezone_sangoma'] = "14";
                $this->settings['timezone_alcatel'] = "America/Chicago";
                $this->settings['timezone_gigaset'] = "GMT-6.America/Chicago";
                $this->settings['timezone_fanvil'] = "-24";
                $this->settings['timezone_name_fanvil'] = "UTC-6";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-360";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Costa_Rica':
            case 'America/El_Salvador':
            case 'America/Guatemala':
            case 'America/Tegucigalpa':
            case 'America/Managua':
            case 'America/Matamoros':
            case 'America/Merida':
            case 'America/Mexico_City':
            case 'America/Monterrey':
            case 'America/Bahia_Banderas':
            case 'Pacific/Galapagos':
            case 'Pacific/Easter':
                $this->settings['timezone_yealink'] = "Mexico(Mexico City,Acapulco)";
                $this->settings['timezone_snom'] = "MEX-6";
                $this->settings['timezone_sangoma'] = "13";
                $this->settings['timezone_alcatel'] = "America/Mexico_City";
                $this->settings['timezone_gigaset'] = "GMT-6.America/Mexico_City";
                $this->settings['timezone_fanvil'] = "-24";
                $this->settings['timezone_name_fanvil'] = "UTC-6";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-360";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
### Offset -05:00
            case 'America/Indiana/Indianapolis':
            case 'America/Indiana/Marengo':
            case 'America/Indiana/Petersburg':
            case 'America/Indiana/Vevay':
            case 'America/Indiana/Vincennes':
            case 'America/Indiana/Winamac':
            case 'America/Detroit':
            case 'America/Kentucky/Louisville':
            case 'America/Kentucky/Monticello':
            case 'America/New_York':
                $this->settings['timezone_yealink'] = "United States-Eastern Time";
                $this->settings['timezone_snom'] = "USA-5";
                $this->settings['timezone_sangoma'] = "18";
                $this->settings['timezone_alcatel'] = "America/New_York";
                $this->settings['timezone_gigaset'] = "GMT-5.America/New_York";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Jamaica':
            case 'America/Nassau':
            case 'America/Nipigon':
            case 'America/Cayman':
                $this->settings['timezone_yealink'] = "Bahamas(Nassau)";
                $this->settings['timezone_snom'] = "BHS-5";
                $this->settings['timezone_sangoma'] = "15";
                $this->settings['timezone_alcatel'] = "America/Nassau";
                $this->settings['timezone_gigaset'] = "GMT-5.America/New_York";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Atikokan':
            case 'America/Toronto':
            case 'America/Iqaluit':
            case 'America/Pangnirtung':
            case 'America/Thunder_Bay':
                $this->settings['timezone_yealink'] = "Canada(Montreal,Ottawa,Quebec)";
                $this->settings['timezone_snom'] = "CAN-5";
                $this->settings['timezone_sangoma'] = "16";
                $this->settings['timezone_alcatel'] = "America/Montreal";
                $this->settings['timezone_gigaset'] = "GMT-5.America/New_York";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Bogota':
            case 'America/Cancun':
            case 'America/Guayaquil':
            case 'America/Lima':
            case 'America/Panama':
            case 'America/Port-au-Prince':
                $this->settings['timezone_yealink'] = "United States-Eastern Time";
                $this->settings['timezone_snom'] = "USA-5";
                $this->settings['timezone_sangoma'] = "18";
                $this->settings['timezone_alcatel'] = "America/Havana";
                $this->settings['timezone_gigaset'] = "GMT-5.America/Bogota";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Havana':
                $this->settings['timezone_yealink'] = "Cuba(Havana)";
                $this->settings['timezone_snom'] = "CUB-5";
                $this->settings['timezone_sangoma'] = "17";
                $this->settings['timezone_alcatel'] = "America/Havana";
                $this->settings['timezone_gigaset'] = "GMT-5.America/Bogota";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Eirunepe':
            case 'America/Rio_Branco':
                $this->settings['timezone_yealink'] = "United States-Eastern Time";
                $this->settings['timezone_snom'] = "USA-5";
                $this->settings['timezone_sangoma'] = "18";
                $this->settings['timezone_alcatel'] = "America/Havana";
                $this->settings['timezone_gigaset'] = "GMT-5.America/Bogota";
                $this->settings['timezone_fanvil'] = "-20";
                $this->settings['timezone_name_fanvil'] = "UTC-5";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "-300";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
### Offset -04:00
            case 'America/Anguilla':
            case 'America/Antigua':
            case 'America/Barbados':
            case 'America/Grand_Turk':
            case 'America/Grenada':
            case 'America/Guyana':
            case 'America/Montserrat':
            case 'America/Port_of_Spain':
            case 'America/St_Kitts':
            case 'America/St_Lucia':
            case 'America/St_Thomas':
            case 'America/St_Vincent':
            case 'Atlantic/Bermuda':
            case 'America/Tortola':
                $this->settings['timezone_yealink'] = "United Kingdom(Bermuda)";
                $this->settings['timezone_snom'] = "BMU-4";
                $this->settings['timezone_sangoma'] = "23";
                $this->settings['timezone_alcatel'] = "Atlantic/Bermuda";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Barbados";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Aruba':
            case 'America/Curacao':
            case 'America/Kralendijk':
            case 'America/Lower_Princes':
                $this->settings['timezone_yealink'] = "United Kingdom(Bermuda)";
                $this->settings['timezone_snom'] = "BMU-4";
                $this->settings['timezone_sangoma'] = "23";
                $this->settings['timezone_alcatel'] = "Atlantic/Bermuda";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Barbados";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "Dutch";
                $this->settings['language_snom'] = "Nederlands";
                $this->settings['language_sangoma'] = "11";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "nl-nl";
		$this->settings['language_fanvil'] = "nl";
		$this->settings['language_fanvil2'] = "3";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "Dutch_Netherland";
            break;
            case 'America/Blanc-Sablon':
            case 'America/Glace_Bay':
            case 'America/Goose_Bay':
            case 'America/Halifax':
            case 'America/Moncton':
                $this->settings['timezone_yealink'] = "Canada(Halifax,Saint John)";
                $this->settings['timezone_snom'] = "CAN-4";
                $this->settings['timezone_sangoma'] = "20";
                $this->settings['timezone_alcatel'] = "America/Halifax";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Halifax";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'America/Boa_Vista':
            case 'America/Manaus':
            case 'America/Porto_Velho':
                $this->settings['timezone_yealink'] = "Paraguay(Asuncion)";
                $this->settings['timezone_snom'] = "PRY-4";
                $this->settings['timezone_sangoma'] = "22";
                $this->settings['timezone_alcatel'] = "America/Asuncion";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Manaus";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
            case 'America/Caracas':
            case 'America/Dominica':
            case 'America/La_Paz':
            case 'America/Puerto_Rico':
            case 'America/Santo_Domingo':
            case 'America/Asuncion':
                $this->settings['timezone_yealink'] = "Paraguay(Asuncion)";
                $this->settings['timezone_snom'] = "PRY-4";
                $this->settings['timezone_sangoma'] = "22";
                $this->settings['timezone_alcatel'] = "America/Asuncion";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Manaus";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Santiago':
            case 'America/Punta_Arenas':
                $this->settings['timezone_yealink'] = "Chile(Santiago)";
                $this->settings['timezone_snom'] = "CHL-4";
                $this->settings['timezone_sangoma'] = "21";
                $this->settings['timezone_alcatel'] = "America/Santiago";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Manaus";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Guadeloupe':
            case 'America/Marigot':
            case 'America/Martinique':
            case 'America/St_Barthelemy':
                $this->settings['timezone_yealink'] = "United Kingdom(Bermuda)";
                $this->settings['timezone_snom'] = "BMU-4";
                $this->settings['timezone_sangoma'] = "23";
                $this->settings['timezone_alcatel'] = "Atlantic/Bermuda";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Barbados";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "6";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'America/Thule':
                $this->settings['timezone_yealink'] = "United Kingdom(Bermuda)";
                $this->settings['timezone_snom'] = "BMU-4";
                $this->settings['timezone_sangoma'] = "23";
                $this->settings['timezone_alcatel'] = "Atlantic/Bermuda";
                $this->settings['timezone_gigaset'] = "GMT-4.America/Barbados";
                $this->settings['timezone_fanvil'] = "-16";
                $this->settings['timezone_name_fanvil'] = "UTC-4";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-240";
                $this->settings['language'] = "Danish";
                $this->settings['language_snom'] = "Dansk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "da-dk";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "da";
                $this->settings['language_polycom'] = "Danish_Denmark";
            break;
### Offset -03:30
            case 'America/St_Johns':
                $this->settings['timezone_yealink'] = "Canada-New Foundland(St.Johns)";
                $this->settings['timezone_snom'] = "CAN-3.5";
                $this->settings['timezone_sangoma'] = "26";
                $this->settings['timezone_alcatel'] = "America/St_Johns";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Godthab";
                $this->settings['timezone_fanvil'] = "-14";
                $this->settings['timezone_name_fanvil'] = "UTC-3:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-210";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset -03:00
            case 'America/Araguaina':
            case 'America/Bahia':
            case 'America/Belem':
            case 'America/Campo_Grande':
            case 'America/Cuiaba':
            case 'America/Fortaleza':
            case 'America/Maceio':
            case 'America/Recife':
            case 'America/Santarem':
                $this->settings['timezone_yealink'] = "Brazil(DST)";
                $this->settings['timezone_snom'] = "BRA1-3";
                $this->settings['timezone_sangoma'] = "30";
                $this->settings['timezone_alcatel'] = "America/Sao_Paulo";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Sao_Paulo";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
            case 'America/Argentina/Buenos_Aires':
            case 'America/Argentina/Catamarca':
            case 'America/Argentina/Cordoba':
            case 'America/Argentina/Jujuy':
            case 'America/Argentina/La_Rioja':
            case 'America/Argentina/Mendoza':
            case 'America/Argentina/Rio_Gallegos':
            case 'America/Argentina/Salta':
            case 'America/Argentina/San_Juan':
            case 'America/Argentina/San_Luis':
            case 'America/Argentina/Tucuman':
            case 'America/Argentina/Ushuaia':
            case 'America/Montevideo':
                $this->settings['timezone_yealink'] = "Argentina(Buenos Aires)";
                $this->settings['timezone_snom'] = "ARG-3";
                $this->settings['timezone_sangoma'] = "28";
                $this->settings['timezone_alcatel'] = "America/Argentina/Buenos_Aires";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Montevideo";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'America/Cayenne':
            case 'America/Miquelon':
                $this->settings['timezone_yealink'] = "Brazil(DST)";
                $this->settings['timezone_snom'] = "BRA1-3";
                $this->settings['timezone_sangoma'] = "30";
                $this->settings['timezone_alcatel'] = "America/Sao_Paulo";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Sao_Paulo";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'America/Godthab':
                $this->settings['timezone_yealink'] = "Denmark-Greenland(Nuuk)";
                $this->settings['timezone_snom'] = "GRL-3";
                $this->settings['timezone_sangoma'] = "27";
                $this->settings['timezone_alcatel'] = "America/Godthab";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Godthab";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "Danish";
                $this->settings['language_snom'] = "Dansk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "da-dk";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "da";
                $this->settings['language_polycom'] = "Danish_Denmark";
            break;
            case 'America/Paramaribo':
                $this->settings['timezone_yealink'] = "Argentina(Buenos Aires)";
                $this->settings['timezone_snom'] = "ARG-3";
                $this->settings['timezone_sangoma'] = "28";
                $this->settings['timezone_alcatel'] = "America/Argentina/Buenos_Aires";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Argentina/Buenos_Aires";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "Dutch";
                $this->settings['language_snom'] = "Nederlands";
                $this->settings['language_sangoma'] = "11";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "nl-nl";
		$this->settings['language_fanvil'] = "nl";
		$this->settings['language_fanvil2'] = "3";
		$this->settings['language_panasonic'] = "nl";
                $this->settings['language_polycom'] = "Dutch_Netherland";
            break;
            case 'Antarctica/Palmer':
            case 'Antarctica/Rothera':
            case 'Atlantic/Stanley':
                $this->settings['timezone_yealink'] = "Argentina(Buenos Aires)";
                $this->settings['timezone_snom'] = "ARG-3";
                $this->settings['timezone_sangoma'] = "28";
                $this->settings['timezone_alcatel'] = "America/Argentina/Buenos_Aires";
                $this->settings['timezone_gigaset'] = "GMT-3.America/Argentina/Buenos_Aires";
                $this->settings['timezone_fanvil'] = "-12";
                $this->settings['timezone_name_fanvil'] = "UTC-3";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-180";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset -01:00
            case 'America/Scoresbysund':
                $this->settings['timezone_yealink'] = "Portugal(Azores)";
                $this->settings['timezone_snom'] = "PRT-1";
                $this->settings['timezone_sangoma'] = "32";
                $this->settings['timezone_alcatel'] = "Atlantic/Azores";
                $this->settings['timezone_gigaset'] = "GMT-1.Atlantic/Azores";
                $this->settings['timezone_fanvil'] = "-4";
                $this->settings['timezone_name_fanvil'] = "UTC-1";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-60";
                $this->settings['language'] = "Danish";
                $this->settings['language_snom'] = "Dansk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "da-dk";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "da";
                $this->settings['language_polycom'] = "Danish_Denmark";
            break;
            case 'Atlantic/Azores':
            case 'Atlantic/Cape_Verde':
                $this->settings['timezone_yealink'] = "Portugal(Azores)";
                $this->settings['timezone_snom'] = "PRT-1";
                $this->settings['timezone_sangoma'] = "32";
                $this->settings['timezone_alcatel'] = "Atlantic/Azores";
                $this->settings['timezone_gigaset'] = "GMT-1.Atlantic/Cape_Verde";
                $this->settings['timezone_fanvil'] = "-4";
                $this->settings['timezone_name_fanvil'] = "UTC-1";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "-60";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
### Offset +00:00
            case 'Africa/Abidjan':
            case 'Africa/Bamako':
            case 'Africa/Casablanca':
            case 'Africa/Conakry':
            case 'Africa/Dakar':
            case 'Africa/Lome':
            case 'Africa/Nouakchott':
            case 'Africa/Ouagadougou':
                $this->settings['timezone_yealink'] = "Morocco";
                $this->settings['timezone_snom'] = "GBR-0";
                $this->settings['timezone_sangoma'] = "40";
                $this->settings['timezone_alcatel'] = "Africa/Casablanca";
                $this->settings['timezone_gigaset'] = "GMT.Africa/Casablanca";
                $this->settings['timezone_fanvil'] = "0";
                $this->settings['timezone_name_fanvil'] = "UTC";
                $this->settings['location_fanvil'] = "8";
                $this->settings['timezone_panasonic'] = "0";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Africa/Accra':
            case 'Africa/Banjul':
            case 'Africa/Freetown':
            case 'Africa/Monrovia':
            case 'Atlantic/St_Helena':
            case 'Europe/Dublin':
            case 'Europe/London':
            case 'Europe/Isle_of_Man':
            case 'Europe/Jersey':
            case 'Europe/Guernsey':
            case 'UTC':
            case 'Antarctica/Troll':
            case 'Atlantic/Reykjavik':
                $this->settings['timezone_yealink'] = "United Kingdom(London)";
                $this->settings['timezone_snom'] = "GBR-0";
                $this->settings['timezone_sangoma'] = "39";
                $this->settings['timezone_alcatel'] = "Europe/London";
                $this->settings['timezone_gigaset'] = "GMT.Europe/London";
                $this->settings['timezone_fanvil'] = "0";
                $this->settings['timezone_name_fanvil'] = "UTC";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "0";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Africa/Bissau':
            case 'Addfrica/Sao_Tome':
            case 'Atlantic/Madeira':
            case 'Europe/Lisbon':
                $this->settings['timezone_yealink'] = "Portugal(Lisboa,Porto,Funchal)";
                $this->settings['timezone_snom'] = "PRT-0";
                $this->settings['timezone_sangoma'] = "37";
                $this->settings['timezone_alcatel'] = "Europe/Lisbon";
                $this->settings['timezone_gigaset'] = "GMT.Africa/Casablanca";
                $this->settings['timezone_fanvil'] = "0";
                $this->settings['timezone_name_fanvil'] = "UTC";
                $this->settings['location_fanvil'] = "5";
                $this->settings['timezone_panasonic'] = "0";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
            case 'Africa/El_Aaiun':
            case 'Atlantic/Canary':
                $this->settings['timezone_yealink'] = "Spain-Canary Islands(Las Palmas)";
                $this->settings['timezone_snom'] = "ESP-0";
                $this->settings['timezone_sangoma'] = "38";
                $this->settings['timezone_alcatel'] = "Atlantic/Canary";
                $this->settings['timezone_gigaset'] = "GMT.Europe/London";
                $this->settings['timezone_fanvil'] = "0";
                $this->settings['timezone_name_fanvil'] = "UTC";
                $this->settings['location_fanvil'] = "6";
                $this->settings['timezone_panasonic'] = "0";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'Atlantic/Faroe':
            case 'America/Danmarkshavn':
                $this->settings['timezone_yealink'] = "Denmark-Faroe Islands(Torshavn)";
                $this->settings['timezone_snom'] = "GBR-0";
                $this->settings['timezone_sangoma'] = "35";
                $this->settings['timezone_alcatel'] = "Atlantic/Faroe";
                $this->settings['timezone_gigaset'] = "GMT.Europe/London";
                $this->settings['timezone_fanvil'] = "0";
                $this->settings['timezone_name_fanvil'] = "UTC";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "0";
                $this->settings['language'] = "Danish";
                $this->settings['language_snom'] = "Dansk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "da-dk";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "da";
                $this->settings['language_polycom'] = "Danish_Denmark";
            break;
### Offset +01:00
            case 'Africa/Algiers':
            case 'Africa/Bangui':
            case 'Africa/Brazzaville':
            case 'Africa/Douala':
            case 'Africa/Kinshasa':
            case 'Africa/Libreville':
            case 'Africa/Ndjamena':
            case 'Africa/Niamey':
            case 'Africa/Porto-Novo':
            case 'Africa/Tunis':
                $this->settings['timezone_yealink'] = "Chad";
                $this->settings['timezone_snom'] = "CHA+1";
                $this->settings['timezone_sangoma'] = "49";
                $this->settings['timezone_alcatel'] = "Europe/Paris";
                $this->settings['timezone_gigaset'] = "GMT+1.Africa/Brazzaville";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "5";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "1";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Europe/Paris':
            case 'Europe/Monaco':
                $this->settings['timezone_yealink'] = "France(Paris)";
                $this->settings['timezone_snom'] = "FRA+1";
                $this->settings['timezone_sangoma'] = "49";
                $this->settings['timezone_alcatel'] = "Europe/Paris";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Brussels";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "10";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Europe/Brussels':
                $this->settings['timezone_yealink'] = "France(Paris)";
                $this->settings['timezone_snom'] = "BEL+1";
                $this->settings['timezone_sangoma'] = "43";
                $this->settings['timezone_alcatel'] = "Europe/Brussels";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Brussels";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "fr";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "60";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Europe/Luxembourg':
                $this->settings['timezone_yealink'] = "Luxembourg(Luxembourg)";
                $this->settings['timezone_snom'] = "LUX+1";
                $this->settings['timezone_sangoma'] = "53";
                $this->settings['timezone_alcatel'] = "Europe/Luxembourg";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Brussels";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "14";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Africa/Ceuta':
            case 'Africa/Malabo':
            case 'Europe/Madrid':
            case 'Europe/Andorra':
                $this->settings['timezone_yealink'] = "Spain(Madrid)";
                $this->settings['timezone_snom'] = "ESP+1";
                $this->settings['timezone_sangoma'] = "52";
                $this->settings['timezone_alcatel'] = "Europe/Rome";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Brussels";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "6";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "Spanish";
                $this->settings['language_snom'] = "Espanol";
                $this->settings['language_sangoma'] = "3";
                $this->settings['language_alcatel'] = "es";
                $this->settings['language_gigaset'] = "es-es";
		$this->settings['language_fanvil'] = "es";
		$this->settings['language_fanvil2'] = "10";
		$this->settings['language_panasonic'] = "es";
                $this->settings['language_polycom'] = "Spanish_Spain";
            break;
            case 'Africa/Lagos':
            case 'Africa/Windhoek':
            case 'Europe/Gibraltar':
            case 'Europe/Malta':
                $this->settings['timezone_yealink'] = "Namibia(Windhoek)";
                $this->settings['timezone_snom'] = "NAM+1";
                $this->settings['timezone_sangoma'] = "52";
                $this->settings['timezone_alcatel'] = "Africa/Windhoek";
                $this->settings['timezone_gigaset'] = "GMT+1.Africa/Brazzaville";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "17";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Africa/Luanda':
                $this->settings['timezone_yealink'] = "Namibia(Windhoek)";
                $this->settings['timezone_snom'] = "NAM+1";
                $this->settings['timezone_sangoma'] = "52";
                $this->settings['timezone_alcatel'] = "Africa/Windhoek";
                $this->settings['timezone_gigaset'] = "GMT+1.Africa/Brazzaville";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "17";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
            case 'Europe/Amsterdam':
                $this->settings['timezone_yealink'] = "Netherlands(Amsterdam)";
                $this->settings['timezone_snom'] = "NLD+1";
                $this->settings['timezone_sangoma'] = "54";
                $this->settings['timezone_alcatel'] = "Europe/Amsterdam";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "16";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "Dutch";
                $this->settings['language_snom'] = "Nederlands";
                $this->settings['language_sangoma'] = "11";
                $this->settings['language_alcatel'] = "nl";
                $this->settings['language_gigaset'] = "nl-nl";
		$this->settings['language_fanvil'] = "nl";
		$this->settings['language_fanvil2'] = "3";
		$this->settings['language_panasonic'] = "nl";
                $this->settings['language_polycom'] = "Dutch_Netherland";
            break;
            case 'Europe/Berlin':
            case 'Europe/Vaduz':
            case 'Europe/Busingen':
            case 'Europe/Zurich':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "GER+1";
                $this->settings['timezone_sangoma'] = "50";
                $this->settings['timezone_alcatel'] = "Europe/Berlin";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "11";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "German";
                $this->settings['language_snom'] = "Deutsch";
                $this->settings['language_sangoma'] = "2";
                $this->settings['language_alcatel'] = "de";
                $this->settings['language_gigaset'] = "de-de";
		$this->settings['language_fanvil'] = "de";
		$this->settings['language_fanvil2'] = "16";
		$this->settings['language_panasonic'] = "de";
                $this->settings['language_polycom'] = "German_Germany";
            break;
            case 'Europe/Vienna':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "GER+1";
                $this->settings['timezone_sangoma'] = "42";
                $this->settings['timezone_alcatel'] = "Europe/Vienna";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "German";
                $this->settings['language_snom'] = "Deutsch";
                $this->settings['language_sangoma'] = "2";
                $this->settings['language_alcatel'] = "de";
                $this->settings['language_gigaset'] = "de-de";
		$this->settings['language_fanvil'] = "de";
		$this->settings['language_fanvil2'] = "16";
		$this->settings['language_panasonic'] = "de";
                $this->settings['language_polycom'] = "German_Germany";
            break;
            case 'Europe/Copenhagen':
                $this->settings['timezone_yealink'] = "Denmark(Kopenhagen)";
                $this->settings['timezone_snom'] = "DNK+1";
                $this->settings['timezone_sangoma'] = "48";
                $this->settings['timezone_alcatel'] = "Europe/Copenhagen";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "9";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "Danish";
                $this->settings['language_snom'] = "Dansk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "da-dk";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "da";
                $this->settings['language_polycom'] = "Danish_Denmark";
            break;
            case 'Europe/Ljubljana':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "SVK+1";
                $this->settings['timezone_sangoma'] = "56";
                $this->settings['timezone_alcatel'] = "Europe/Vienna";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "en";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Slovenian";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "sl-sl";
		$this->settings['language_fanvil'] = "slo";
		$this->settings['language_fanvil2'] = "13";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "Slovenian_Slovenia";
            break;
            case 'Europe/Bratislava':
            case 'Europe/Podgorica':
            case 'Europe/Sarajevo':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "SVK+1";
                $this->settings['timezone_sangoma'] = "56";
                $this->settings['timezone_alcatel'] = "Europe/Berlin";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "15";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "sk";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Skopje':
                $this->settings['timezone_yealink'] = "Macedonia(Skopje)";
                $this->settings['timezone_snom'] = "MAK+1";
                $this->settings['timezone_sangoma'] = "56";
                $this->settings['timezone_alcatel'] = "Europe/Skopje";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "15";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "me";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Belgrade':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "GER+1";
                $this->settings['timezone_sangoma'] = "56";
                $this->settings['timezone_alcatel'] = "Europe/Skopje";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Belgrade";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "15";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Budapest':
                $this->settings['timezone_yealink'] = "Hungary(Budapest)";
                $this->settings['timezone_snom'] = "HUN+1";
                $this->settings['timezone_sangoma'] = "51";
                $this->settings['timezone_alcatel'] = "Europe/Budapest";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "12";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Hungarian";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "12";
		$this->settings['language_panasonic'] = "hu";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Prague':
                $this->settings['timezone_yealink'] = "Czech Republic(Prague)";
                $this->settings['timezone_snom'] = "CZE+1";
                $this->settings['timezone_sangoma'] = "47";
                $this->settings['timezone_alcatel'] = "Europe/Prague";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "8";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Čeština";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "cs-cz";
		$this->settings['language_fanvil'] = "cz";
		$this->settings['language_fanvil2'] = "18";
		$this->settings['language_panasonic'] = "cs";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Stockholm':
                $this->settings['timezone_yealink'] = "Denmark(Kopenhagen)";
                $this->settings['timezone_snom'] = "SWE+1";
                $this->settings['timezone_sangoma'] = "48";
                $this->settings['timezone_alcatel'] = "Europe/Copenhagen";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "9";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Svenska";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "sv-se";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "sv";
                $this->settings['language_polycom'] = "Swedish_Sweden";
            break;
            case 'Europe/Zagreb':
                $this->settings['timezone_yealink'] = "Croatia(Zagreb)";
                $this->settings['timezone_snom'] = "HRV+1";
                $this->settings['timezone_sangoma'] = "46";
                $this->settings['timezone_alcatel'] = "Europe/Zagreb";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "7";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "sh";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Tirane':
                $this->settings['timezone_yealink'] = "Albania(Tirane)";
                $this->settings['timezone_snom'] = "ALB+1";
                $this->settings['timezone_sangoma'] = "41";
                $this->settings['timezone_alcatel'] = "Europe/Tirane";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Sarajevo";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Rome':
            case 'Europe/San_Marino':
            case 'Europe/Vatican':
                $this->settings['timezone_yealink'] = "Italy(Rome)";
                $this->settings['timezone_snom'] = "ITA+1";
                $this->settings["timezone_sangoma"] = "52";
                $this->settings['timezone_alcatel'] = "Europe/Rome";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "13";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "Italian";
                $this->settings['language_snom'] = "Italiano";
                $this->settings['language_sangoma'] = "6";
                $this->settings['language_alcatel'] = "it";
                $this->settings['language_gigaset'] = "it-it";
		$this->settings['language_fanvil'] = "it";
		$this->settings['language_fanvil2'] = "7";
		$this->settings['language_panasonic'] = "it";
                $this->settings['language_polycom'] = "Italian_Italy";
            break;
            case 'Europe/Warsaw':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "POL+1";
                $this->settings['timezone_sangoma'] = "55";
                $this->settings['timezone_alcatel'] = "Europe/Berlin";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "11";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Polski";
                $this->settings['language_sangoma'] = "7";
                $this->settings['language_alcatel'] = "pl";
                $this->settings['language_gigaset'] = "pl-pl";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "5";
		$this->settings['language_panasonic'] = "pl";
                $this->settings['language_polycom'] = "Polish_Poland";
            break;
            case 'Arctic/Longyearbyen':
            case 'Europe/Oslo':
                $this->settings['timezone_yealink'] = "Germany(Berlin)";
                $this->settings['timezone_snom'] = "NOR+1";
                $this->settings['timezone_sangoma'] = "55";
                $this->settings['timezone_alcatel'] = "Europe/Berlin";
                $this->settings['timezone_gigaset'] = "GMT+1.Europe/Amsterdam";
                $this->settings['timezone_fanvil'] = "4";
                $this->settings['timezone_name_fanvil'] = "UTC+1";
                $this->settings['location_fanvil'] = "9";
                $this->settings['timezone_panasonic'] = "60";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Norsk";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "no";
                $this->settings['language_polycom'] = "Norwegian_Norway";
            break;
### Offset +02:00
            case 'Africa/Blantyre':
            case 'Africa/Cairo':
            case 'Africa/Gaborone':
            case 'Africa/Harare':
            case 'Africa/Johannesburg':
            case 'Africa/Kigali':
            case 'Africa/Lusaka':
            case 'Africa/Maseru':
            case 'Africa/Mbabane':
            case 'Africa/Tripoli':
            case 'Asia/Amman':
                $this->settings['timezone_yealink'] = "Jordan(Amman)";
                $this->settings['timezone_snom'] = "JOR+2";
                $this->settings['timezone_sangoma'] = "62";
                $this->settings['timezone_alcatel'] = "Asia/Amman";
                $this->settings['timezone_gigaset'] = "GMT+2.Asia/Amman";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "12";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Beirut':
                $this->settings['timezone_yealink'] = "Lebanon(Beirut)";
                $this->settings['timezone_snom'] = "LBN+2";
                $this->settings['timezone_sangoma'] = "64";
                $this->settings['timezone_alcatel'] = "Asia/Beirut";
                $this->settings['timezone_gigaset'] = "GMT+2.Asia/Beirut";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "8";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Damascus':
                $this->settings['timezone_yealink'] = "Syria(Damascus)";
                $this->settings['timezone_snom'] = "SYR+2";
                $this->settings['timezone_sangoma'] = "68";
                $this->settings['timezone_alcatel'] = "Asia/Damascus";
                $this->settings['timezone_gigaset'] = "GMT+2.Asia/Amman";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "12";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Gaza':
            case 'Asia/Hebron':
                $this->settings['timezone_yealink'] = "Gaza Strip(Gaza)";
                $this->settings['timezone_snom'] = "GAZ+2";
                $this->settings['timezone_sangoma'] = "59";
                $this->settings['timezone_alcatel'] = "Asia/Gaza";
                $this->settings['timezone_gigaset'] = "GMT+2.Asia/Beirut";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Jerusalem':
                $this->settings['timezone_yealink'] = "Israel(Tel Aviv)";
                $this->settings['timezone_snom'] = "ISR+2";
                $this->settings['timezone_sangoma'] = "61";
                $this->settings['timezone_alcatel'] = "Asia/Jerusalem";
                $this->settings['timezone_gigaset'] = "GMT+2.Asia/Jerusalem";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "5";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "he";
		$this->settings['language_fanvil2'] = "8";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Nicosia':
                $this->settings['timezone_yealink'] = "Greece(Athens)";
                $this->settings['timezone_snom'] = "CYP+2";
                $this->settings['timezone_sangoma'] = "70";
                $this->settings['timezone_alcatel'] = "Europe/Athens";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Athens";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "el";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Kiev':
            case 'Europe/Uzhgorod':
            case 'Europe/Zaporozhye':
                $this->settings['timezone_yealink'] = "Ukraine(Kyiv, Odessa)";
                $this->settings['timezone_snom'] = "UKR+2";
                $this->settings['timezone_sangoma'] = "70";
                $this->settings['timezone_alcatel'] = "Europe/Kiev";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Helsinki";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "13";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "ua";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "uk";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Africa/Bujumbura':
            case 'Africa/Lubumbashi':
                $this->settings['timezone_yealink'] = "Lebanon(Beirut)";
                $this->settings['timezone_snom'] = "EGY+2";
                $this->settings['timezone_sangoma'] = "64";
                $this->settings['timezone_alcatel'] = "Asia/Beirut";
                $this->settings['timezone_gigaset'] = "GMT+2.Africa/Harare";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Africa/Maputo':
                $this->settings['timezone_yealink'] = "Lebanon(Beirut)";
                $this->settings['timezone_snom'] = "EGY+2";
                $this->settings['timezone_sangoma'] = "64";
                $this->settings['timezone_alcatel'] = "Asia/Beirut";
                $this->settings['timezone_gigaset'] = "GMT+2.Africa/Harare";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "Portuguese";
                $this->settings['language_snom'] = "Portugues";
                $this->settings['language_sangoma'] = "4";
                $this->settings['language_alcatel'] = "pt";
                $this->settings['language_gigaset'] = "pt-pt";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "17";
		$this->settings['language_panasonic'] = "pt";
                $this->settings['language_polycom'] = "Portuguese_Portugal";
            break;
            case 'Europe/Athens':
                $this->settings['timezone_yealink'] = "Greece(Athens)";
                $this->settings['timezone_snom'] = "GRC+2";
                $this->settings['timezone_sangoma'] = "106";
                $this->settings['timezone_alcatel'] = "Europe/Athens";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Athens";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "el";
                $this->settings['language_gigaset'] = "el-gr";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "el";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Bucharest':
                $this->settings['timezone_yealink'] = "Romania(Bucharest)";
                $this->settings['timezone_snom'] = "ROU+2";
                $this->settings['timezone_sangoma'] = "67";
                $this->settings['timezone_alcatel'] = "Europe/Bucharest";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Athens";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "11";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "ro-ro";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "ro";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Chisinau':
                $this->settings['timezone_yealink'] = "Moldova(Kishinev)";
                $this->settings['timezone_snom'] = "MDA+2";
                $this->settings['timezone_sangoma'] = "65";
                $this->settings['timezone_alcatel'] = "Europe/Chisinau";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Athens";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "9";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Helsinki':
            case 'Europe/Mariehamn':
                $this->settings['timezone_yealink'] = "Finland(Helsinki)";
                $this->settings['timezone_snom'] = "FIN+2";
                $this->settings['timezone_sangoma'] = "58";
                $this->settings['timezone_alcatel'] = "Europe/Helsinki";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Helsinki";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "Suomi";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "fi";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Kaliningrad':
                $this->settings['timezone_yealink'] = "Russia(Kaliningrad)";
                $this->settings['timezone_snom'] = "RUS+2";
                $this->settings['timezone_sangoma'] = "66";
                $this->settings['timezone_alcatel'] = "Europe/Kaliningrad";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Helsinki";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "10";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "Russian";
                $this->settings['language_snom'] = "Russian";
                $this->settings['language_sangoma'] = "5";
                $this->settings['language_alcatel'] = "ru";
                $this->settings['language_gigaset'] = "ru-ru";
		$this->settings['language_fanvil'] = "ru";
		$this->settings['language_fanvil2'] = "6";
		$this->settings['language_panasonic'] = "ru";
                $this->settings['language_polycom'] = "Russian_Russia";
            break;
            case 'Europe/Riga':
                $this->settings['timezone_yealink'] = "Latvia(Riga)";
                $this->settings['timezone_snom'] = "63";
                $this->settings['timezone_sangoma'] = "LVA+2";
                $this->settings['timezone_alcatel'] = "Europe/Riga";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Helsinki";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "7";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Sofia':
                $this->settings['timezone_yealink'] = "Greece(Athens)";
                $this->settings['timezone_snom'] = "BLR+2";
                $this->settings['timezone_sangoma'] = "57";
                $this->settings['timezone_alcatel'] = "Europe/Athens";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Athens";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "12";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Vilnius':
            case 'Europe/Tallinn':
                $this->settings['timezone_yealink'] = "Estonia(Tallinn)";
                $this->settings['timezone_snom'] = "EST+2";
                $this->settings['timezone_sangoma'] = "57";
                $this->settings['timezone_alcatel'] = "Europe/Tallinn";
                $this->settings['timezone_gigaset'] = "GMT+2.Europe/Helsinki";
                $this->settings['timezone_fanvil'] = "8";
                $this->settings['timezone_name_fanvil'] = "UTC+2";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "120";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +03:00
            case 'Africa/Addis_Ababa':
            case 'Africa/Asmara':
            case 'Africa/Dar_es_Salaam':
            case 'Africa/Juba':
            case 'Africa/Kampala':
            case 'Africa/Khartoum':
            case 'Africa/Mogadishu':
            case 'Africa/Nairobi':
            case 'Antarctica/Syowa':
                $this->settings['timezone_yealink'] = "East Africa Time";
                $this->settings['timezone_snom'] = "EAT+3";
                $this->settings['timezone_sangoma'] = "71";
                $this->settings['timezone_alcatel'] = "Africa/Djibouti";
                $this->settings['timezone_gigaset'] = "GMT+3.Africa/Nairob";
                $this->settings['timezone_fanvil'] = "12";
                $this->settings['timezone_name_fanvil'] = "UTC+3";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "180";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Aden':
            case 'Asia/Baghdad':
            case 'Asia/Kuwait':
            case 'Asia/Riyadh':
            case 'Indian/Antananarivo':
            case 'Indian/Comoro':
            case 'Indian/Mayotte':
                $this->settings['timezone_yealink'] = "Iraq(Baghdad)";
                $this->settings['timezone_snom'] = "IRQ+3";
                $this->settings['timezone_sangoma'] = "72";
                $this->settings['timezone_alcatel'] = "Asia/Baghdad";
                $this->settings['timezone_gigaset'] = "GMT+3.Asia/Baghdad";
                $this->settings['timezone_fanvil'] = "12";
                $this->settings['timezone_name_fanvil'] = "UTC+3";
                $this->settings['location_fanvil'] = "6";
                $this->settings['timezone_panasonic'] = "180";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Africa/Djibouti':
                $this->settings['timezone_yealink'] = "East Africa Time";
                $this->settings['timezone_snom'] = "EAT+3";
                $this->settings['timezone_sangoma'] = "71";
                $this->settings['timezone_alcatel'] = "Africa/Djibouti";
                $this->settings['timezone_gigaset'] = "GMT+3.Africa/Nairob";
                $this->settings['timezone_fanvil'] = "12";
                $this->settings['timezone_name_fanvil'] = "UTC+3";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "180";
                $this->settings['language'] = "French";
                $this->settings['language_snom'] = "Francais";
                $this->settings['language_sangoma'] = "1";
                $this->settings['language_alcatel'] = "fr";
                $this->settings['language_gigaset'] = "fr-fr";
		$this->settings['language_fanvil'] = "fr";
		$this->settings['language_fanvil2'] = "4";
		$this->settings['language_panasonic'] = "fr";
                $this->settings['language_polycom'] = "French_France";
            break;
            case 'Asia/Famagusta':
            case 'Europe/Istanbul':
                $this->settings['timezone_yealink'] = "Turkey(Ankara)";
                $this->settings['timezone_snom'] = "TUR+2";
                $this->settings['timezone_sangoma'] = "69";
                $this->settings['timezone_alcatel'] = "Europe/Istanbul";
                $this->settings['timezone_gigaset'] = "MT+3.Europe/Moscow";
                $this->settings['timezone_fanvil'] = "12";
                $this->settings['timezone_name_fanvil'] = "UTC+3";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "180";
                $this->settings['language'] = "Turkish";
                $this->settings['language_snom'] = "Turkce";
                $this->settings['language_sangoma'] = "8";
                $this->settings['language_alcatel'] = "tr";
                $this->settings['language_gigaset'] = "tr-tr";
		$this->settings['language_fanvil'] = "tr";
		$this->settings['language_fanvil2'] = "9";
		$this->settings['language_panasonic'] = "tr";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Kirov':
            case 'Europe/Minsk':
            case 'Europe/Moscow':
            case 'Europe/Simferopol':
            case 'Europe/Volgograd':
                $this->settings['timezone_yealink'] = "Russia(Moscow)";
                $this->settings['timezone_snom'] = "RUS+3";
                $this->settings['timezone_sangoma'] = "73";
                $this->settings['timezone_alcatel'] = "Europe/Moscow";
                $this->settings['timezone_gigaset'] = "MT+3.Europe/Moscow";
                $this->settings['timezone_fanvil'] = "12";
                $this->settings['timezone_name_fanvil'] = "UTC+3";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "180";
                $this->settings['language'] = "Russian";
                $this->settings['language_snom'] = "Russian";
                $this->settings['language_sangoma'] = "5";
                $this->settings['language_alcatel'] = "ru";
                $this->settings['language_gigaset'] = "ru-ru";
		$this->settings['language_fanvil'] = "ru";
		$this->settings['language_fanvil2'] = "6";
		$this->settings['language_panasonic'] = "ru";
                $this->settings['language_polycom'] = "Russian_Russia";
            break;
### Offset +03:30
            case 'Asia/Tehran':
                $this->settings['timezone_yealink'] = "Iran(Teheran)";
                $this->settings['timezone_snom'] = "IRN+3.5";
                $this->settings['timezone_sangoma'] = "74";
                $this->settings['timezone_alcatel'] = "Asia/Tehran";
                $this->settings['timezone_gigaset'] = "GMT+3.Asia/Baghdad";
                $this->settings['timezone_fanvil'] = "14";
                $this->settings['timezone_name_fanvil'] = "UTC+3:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "210";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +04:00
            case 'Asia/Baku':
                $this->settings['timezone_yealink'] = "Azerbaijan(Baku)";
                $this->settings['timezone_snom'] = "AZE+4";
                $this->settings['timezone_sangoma'] = "76";
                $this->settings['timezone_alcatel'] = "Asia/Baku";
                $this->settings['timezone_gigaset'] = "GMT+4.Asia/Baku";
                $this->settings['timezone_fanvil'] = "16";
                $this->settings['timezone_name_fanvil'] = "UTC+4";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "kk";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Tbilisi':
                $this->settings['timezone_yealink'] = "Georgia(Tbilisi)";
                $this->settings['timezone_snom'] = "GEO+4";
                $this->settings['timezone_sangoma'] = "77";
                $this->settings['timezone_alcatel'] = "Asia/Tbilisi";
                $this->settings['timezone_gigaset'] = "GMT+4.Asia/Tbilisi";
                $this->settings['timezone_fanvil'] = "16";
                $this->settings['timezone_name_fanvil'] = "UTC+4";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Yerevan':
                $this->settings['timezone_yealink'] = "Armenia(Yerevan)";
                $this->settings['timezone_snom'] = "ARM+4";
                $this->settings['timezone_sangoma'] = "75";
                $this->settings['timezone_alcatel'] = "Asia/Yerevan";
                $this->settings['timezone_gigaset'] = "GMT+4.Asia/Yerevan";
                $this->settings['timezone_fanvil'] = "16";
                $this->settings['timezone_name_fanvil'] = "UTC+4";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Bahrain':
            case 'Asia/Dubai':
            case 'Asia/Muscat':
            case 'Asia/Qatar':
            case 'Indian/Mahe':
            case 'Indian/Mauritius':
            case 'Indian/Reunion':
                $this->settings['timezone_yealink'] = "Kazakhstan(Aktau)";
                $this->settings['timezone_snom'] = "KAZ+4";
                $this->settings['timezone_sangoma'] = "78";
                $this->settings['timezone_alcatel'] = "Asia/Aqtau";
                $this->settings['timezone_gigaset'] = "GMT+4.Asia/Dubai";
                $this->settings['timezone_fanvil'] = "16";
                $this->settings['timezone_name_fanvil'] = "UTC+4";
                $this->settings['location_fanvil'] = "7";
                $this->settings['timezone_panasonic'] = "240";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Europe/Astrakhan':
            case 'Europe/Samara':
            case 'Europe/Saratov':
            case 'Europe/Ulyanovsk':
                $this->settings['timezone_yealink'] = "Russia(Samara)";
                $this->settings['timezone_snom'] = "RUS+4";
                $this->settings['timezone_sangoma'] = "79";
                $this->settings['timezone_alcatel'] = "Europe/Samara";
                $this->settings['timezone_gigaset'] = "GMT+4.Asia/Baku";
                $this->settings['timezone_fanvil'] = "16";
                $this->settings['timezone_name_fanvil'] = "UTC+4";
                $this->settings['location_fanvil'] = "5";
                $this->settings['timezone_panasonic'] = "240";
                $this->settings['language'] = "Russian";
                $this->settings['language_snom'] = "Russian";
                $this->settings['language_sangoma'] = "5";
                $this->settings['language_alcatel'] = "ru";
                $this->settings['language_gigaset'] = "ru-ru";
		$this->settings['language_fanvil'] = "ru";
		$this->settings['language_fanvil2'] = "6";
		$this->settings['language_panasonic'] = "ru";
                $this->settings['language_polycom'] = "Russian_Russia";
            break;
### Offset +04:30
            case 'Asia/Kabul':
                $this->settings['timezone_yealink'] = "Afghanistan(Kabul)";
                $this->settings['timezone_snom'] = "PAK+5";
                $this->settings['timezone_sangoma'] = "82";
                $this->settings['timezone_alcatel'] = "Asia/Karachi";
                $this->settings['timezone_gigaset'] = "GMT+5.Asia/Karachi";
                $this->settings['timezone_fanvil'] = "18";
                $this->settings['timezone_name_fanvil'] = "UTC+4:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "270";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "6";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +05:00
            case 'Antarctica/Mawson':
            case 'Asia/Aqtau':
            case 'Asia/Aqtobe':
            case 'Asia/Ashgabat':
            case 'Asia/Atyrau':
            case 'Asia/Dushanbe':
            case 'Asia/Karachi':
            case 'Asia/Oral':
            case 'Asia/Samarkand':
            case 'Asia/Tashkent':
            case 'Asia/Yekaterinburg':
            case 'Indian/Kerguelen':
            case 'Indian/Maldives':
                $this->settings['timezone_yealink'] = "Russia(Chelyabinsk)";
                $this->settings['timezone_snom'] = "RUS+5";
                $this->settings['timezone_sangoma'] = "83";
                $this->settings['timezone_alcatel'] = "Asia/Aqtobe";
                $this->settings['timezone_gigaset'] = "GMT+5.Asia/Karachi";
                $this->settings['timezone_fanvil'] = "20";
                $this->settings['timezone_name_fanvil'] = "UTC+5";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "300";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +05:30
            case 'Asia/Colombo':
            case 'Asia/Kolkata':
                $this->settings['timezone_yealink'] = "India(Calcutta)";
                $this->settings['timezone_snom'] = "IND+5.5";
                $this->settings['timezone_sangoma'] = "84";
                $this->settings['timezone_alcatel'] = "Asia/Kolkata";
                $this->settings['timezone_gigaset'] = "GMT+5.Asia/Karachi";
                $this->settings['timezone_fanvil'] = "22";
                $this->settings['timezone_name_fanvil'] = "UTC+5:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "330";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +05:45
            case 'Asia/Kathmandu':
                $this->settings['timezone_yealink'] = "Nepal(Katmandu)";
                $this->settings['timezone_snom'] = "RUS+6";
                $this->settings['timezone_sangoma'] = "85";
                $this->settings['timezone_alcatel'] = "Asia/Kolkata";
                $this->settings['timezone_gigaset'] = "GMT+5.Asia/Karachi";
                $this->settings['timezone_fanvil'] = "23";
                $this->settings['timezone_name_fanvil'] = "UTC+5:45";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "345";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +06:00
            case 'Antarctica/Vostok':
            case 'Asia/Almaty':
            case 'Asia/Bishkek':
            case 'Asia/Dhaka':
            case 'Asia/Omsk':
            case 'Asia/Qyzylorda':
            case 'Asia/Thimphu':
            case 'Asia/Urumqi':
            case 'Indian/Chagos':
                $this->settings['timezone_yealink'] = "Kazakhstan(Astana, Almaty)";
                $this->settings['timezone_snom'] = "KAZ+6";
                $this->settings['timezone_sangoma'] = "85";
                $this->settings['timezone_alcatel'] = "Asia/Almaty";
                $this->settings['timezone_gigaset'] = "GMT+6.Asia/Almaty";
                $this->settings['timezone_fanvil'] = "24";
                $this->settings['timezone_name_fanvil'] = "UTC+6";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "360";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +06:30
            case 'Asia/Yangon':
            case 'Indian/Cocos':
                $this->settings['timezone_yealink'] = "Myanmar(Naypyitaw)";
                $this->settings['timezone_snom'] = "CHN+7";
                $this->settings['timezone_sangoma'] = "87";
                $this->settings['timezone_alcatel'] = "Asia/Almaty";
                $this->settings['timezone_gigaset'] = "GMT+7.Asia/Bangkok";
                $this->settings['timezone_fanvil'] = "26";
                $this->settings['timezone_name_fanvil'] = "UTC+6:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "390";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +07:00
            case 'Antarctica/Davis':
            case 'Asia/Bangkok':
            case 'Asia/Barnaul':
            case 'Asia/Ho_Chi_Minh':
            case 'Asia/Hovd':
            case 'Asia/Jakarta':
            case 'Asia/Krasnoyarsk':
            case 'Asia/Novokuznetsk':
            case 'Asia/Novosibirsk':
            case 'Asia/Phnom_Penh':
            case 'Asia/Pontianak':
            case 'Asia/Tomsk':
            case 'Asia/Vientiane':
            case 'Indian/Christmas':
                $this->settings['timezone_yealink'] = "Russia(Krasnoyarsk)";
                $this->settings['timezone_snom'] = "RUS+7";
                $this->settings['timezone_sangoma'] = "87";
                $this->settings['timezone_alcatel'] = "Asia/Bangkok";
                $this->settings['timezone_gigaset'] = "GMT+7.Asia/Bangkok";
                $this->settings['timezone_fanvil'] = "28";
                $this->settings['timezone_name_fanvil'] = "UTC+7";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "420";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +08:00
            case 'Asia/Brunei':
            case 'Asia/Choibalsan':
            case 'Asia/Hong_Kong':
            case 'Asia/Irkutsk':
            case 'Asia/Kuala_Lumpur':
            case 'Asia/Kuching':
            case 'Asia/Macau':
            case 'Asia/Makassar':
            case 'Asia/Manila':
            case 'Asia/Taipei':
            case 'Asia/Ulaanbaatar':
            case 'Asia/Shanghai':
                $this->settings['timezone_yealink'] = "China(Beijing)";
                $this->settings['timezone_snom'] = "KOR+8";
                $this->settings['timezone_sangoma'] = "89";
                $this->settings['timezone_alcatel'] = "Asia/Shanghai";
                $this->settings['timezone_gigaset'] = "GMT+8.Asia/Kuala_Lumpur";
                $this->settings['timezone_fanvil'] = "32";
                $this->settings['timezone_name_fanvil'] = "UTC+8";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "480";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Singapore':
                $this->settings['timezone_yealink'] = "Singapore(Singapore)";
                $this->settings['timezone_snom'] = "SGP+8";
                $this->settings['timezone_sangoma'] = "90";
                $this->settings['timezone_alcatel'] = "Asia/Singapore";
                $this->settings['timezone_gigaset'] = "GMT+8.Asia/Hong_Kon";
                $this->settings['timezone_fanvil'] = "32";
                $this->settings['timezone_name_fanvil'] = "";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "480";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Australia/Perth':
                $this->settings['timezone_yealink'] = "Australia(Perth)";
                $this->settings['timezone_snom'] = "AUS+8";
                $this->settings['timezone_sangoma'] = "91";
                $this->settings['timezone_alcatel'] = "Australia/Perth";
                $this->settings['timezone_gigaset'] = "GMT+8.Australia/Perth";
                $this->settings['timezone_fanvil'] = "32";
                $this->settings['timezone_name_fanvil'] = "480";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "480";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +08:30
            case 'Asia/Pyongyang':
### Offset +08:45
            case 'Australia/Eucla':
 ### Offset +09:00
            case 'Asia/Chita':
            case 'Asia/Dili':
            case 'Asia/Jayapura':
            case 'Asia/Khandyga':
            case 'Asia/Yakutsk':
            case 'Pacific/Palau':
            case 'Asia/Tokyo':
                $this->settings['timezone_yealink'] = "Japan(Tokyo)";
                $this->settings['timezone_snom'] = "";
                $this->settings['timezone_sangoma'] = "93";
                $this->settings['timezone_alcatel'] = "Asia/Tokyo";
                $this->settings['timezone_gigaset'] = "GMT+9.Asia/Tokyo";
                $this->settings['timezone_fanvil'] = "36";
                $this->settings['timezone_name_fanvil'] = "UTC+9";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "540";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Seoul':
                $this->settings['timezone_yealink'] = "Korea(Seoul)";
                $this->settings['timezone_snom'] = "";
                $this->settings['timezone_sangoma'] = "92";
                $this->settings['timezone_alcatel'] = "Asia/Seoul";
                $this->settings['timezone_gigaset'] = "GMT+9.Asia/Seoul";
                $this->settings['timezone_fanvil'] = "36";
                $this->settings['timezone_name_fanvil'] = "UTC+9";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "540";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "ko";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +09:30
            case 'Australia/Adelaide':
                $this->settings['timezone_yealink'] = "Australia(Adelaide)";
                $this->settings['timezone_snom'] = "AUS+9.5";
                $this->settings['timezone_sangoma'] = "94";
                $this->settings['timezone_alcatel'] = "Australia/Adelaide";
                $this->settings['timezone_gigaset'] = "GMT+10.Australia/Sydney";
                $this->settings['timezone_fanvil'] = "38";
                $this->settings['timezone_name_fanvil'] = "UTC+9:30";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "570";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Australia/Darwin':
                $this->settings['timezone_yealink'] = "Australia(Darwin)";
                $this->settings['timezone_snom'] = "AUS+9.5";
                $this->settings['timezone_sangoma'] = "95";
                $this->settings['timezone_alcatel'] = "Australia/Darwin";
                $this->settings['timezone_gigaset'] = "GMT+10.Australia/Sydney";
                $this->settings['timezone_fanvil'] = "38";
                $this->settings['timezone_name_fanvil'] = "UTC+9:30";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "570";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +10:00
            case 'Australia/Brisbane':
                $this->settings['timezone_yealink'] = "Australia(Brisbane)";
                $this->settings['timezone_snom'] = "AUS+10";
                $this->settings['timezone_sangoma'] = "97";
                $this->settings['timezone_alcatel'] = "Australia/Brisbane";
                $this->settings['timezone_gigaset'] = "GMT+10.Australia/Brisbane";
                $this->settings['timezone_fanvil'] = "40";
                $this->settings['timezone_name_fanvil'] = "UTC+10";
                $this->settings['location_fanvil'] = "2";
                $this->settings['timezone_panasonic'] = "600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Australia/Hobart':
                $this->settings['timezone_yealink'] = "Australia(Hobart)";
                $this->settings['timezone_snom'] = "AUS+10";
                $this->settings['timezone_sangoma'] = "98";
                $this->settings['timezone_alcatel'] = "Australia/Hobart";
                $this->settings['timezone_gigaset'] = "GMT+10.Australia/Hobart";
                $this->settings['timezone_fanvil'] = "40";
                $this->settings['timezone_name_fanvil'] = "UTC+10";
                $this->settings['location_fanvil'] = "3";
                $this->settings['timezone_panasonic'] = "600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Antarctica/DumontDUrville':
            case 'Australia/Lindeman':
            case 'Australia/Currie':
            case 'Australia/Lord_Howe':
            case 'Australia/Melbourne':
            case 'Australia/Sydney':
            case 'Pacific/Chuuk':
            case 'Pacific/Guam':
            case 'Pacific/Port_Moresby':
            case 'Pacific/Saipan':
                $this->settings['timezone_yealink'] = "Australia(Sydney,Melboume,Canberra)";
                $this->settings['timezone_snom'] = "AUS+10";
                $this->settings['timezone_sangoma'] = "96";
                $this->settings['timezone_alcatel'] = "Australia/Sydney";
                $this->settings['timezone_gigaset'] = "GMT+10.Australia/Sydney";
                $this->settings['timezone_fanvil'] = "40";
                $this->settings['timezone_name_fanvil'] = "UTC+10";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            case 'Asia/Ust-Nera':
            case 'Asia/Vladivostok':
                $this->settings['timezone_yealink'] = "Russia(Vladivostok)";
                $this->settings['timezone_snom'] = "RUS+10";
                $this->settings['timezone_sangoma'] = "96";
                $this->settings['timezone_alcatel'] = "Asia/Vladivostok";
                $this->settings['timezone_gigaset'] = "GMT+10.Asia/Vladivostok";
                $this->settings['timezone_fanvil'] = "40";
                $this->settings['timezone_name_fanvil'] = "UTC+10";
                $this->settings['location_fanvil'] = "4";
                $this->settings['timezone_panasonic'] = "600";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +10:30
            case 'Australia/Broken_Hill':
                $this->settings['timezone_yealink'] = "Australia(Lord Howe Islands)";
                $this->settings['timezone_snom'] = "AUS+10.5";
                $this->settings['timezone_sangoma'] = "100";
                $this->settings['timezone_alcatel'] = "Australia/Lord_Howe";
                $this->settings['timezone_gigaset'] = "Australia/Lord_Howe";
                $this->settings['timezone_fanvil'] = "42";
                $this->settings['timezone_name_fanvil'] = "UTC+10";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "630";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +11:00
            case 'Antarctica/Casey':
            case 'Antarctica/Macquarie':
            case 'Asia/Magadan':
            case 'Asia/Sakhalin':
            case 'Asia/Srednekolymsk':
            case 'Pacific/Bougainville':
            case 'Pacific/Efate':
            case 'Pacific/Guadalcanal':
            case 'Pacific/Kosrae':
            case 'Pacific/Norfolk':
            case 'Pacific/Noumea':
            case 'Pacific/Pohnpei':
                $this->settings['timezone_yealink'] = "New Caledonia(Noumea)";
                $this->settings['timezone_snom'] = "NCL+11";
                $this->settings['timezone_sangoma'] = "101";
                $this->settings['timezone_alcatel'] = "Pacific/Noumea";
                $this->settings['timezone_gigaset'] = "GMT+12.Pacific/Fiji";
                $this->settings['timezone_fanvil'] = "44";
                $this->settings['timezone_name_fanvil'] = "UTC+11";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "660";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +12:00
            case 'Asia/Anadyr':
            case 'Asia/Kamchatka':
            case 'Pacific/Funafuti':
            case 'Pacific/Kwajalein':
            case 'Pacific/Majuro':
            case 'Pacific/Nauru':
            case 'Pacific/Tarawa':
            case 'Pacific/Wake':
            case 'Pacific/Wallis':
            case 'Pacific/Auckland':
                $this->settings['timezone_yealink'] = "New Zealand(Wellington,Auckland)";
                $this->settings['timezone_snom'] = "NZL+12";
                $this->settings['timezone_sangoma'] = "102";
                $this->settings['timezone_alcatel'] = "Pacific/Auckland";
                $this->settings['timezone_gigaset'] = "GMT+12.Pacific/Auckland";
                $this->settings['timezone_fanvil'] = "48";
                $this->settings['timezone_name_fanvil'] = "UTC+12";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "720";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +12:45
    case 'Pacific/Chatham':
                $this->settings['timezone_yealink'] = "Chatham Islands";
                $this->settings['timezone_snom'] = "NZL+12.75";
                $this->settings['timezone_sangoma'] = "103";
                $this->settings['timezone_alcatel'] = "Pacific/Chatham";
                $this->settings['timezone_gigaset'] = "GMT+13.Pacific/Tongatapu";
                $this->settings['timezone_fanvil'] = "51";
                $this->settings['timezone_name_fanvil'] = "UTC+12:45";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "765";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +13:00
            case 'Antarctica/McMurdo':
            case 'Pacific/Enderbury':
            case 'Pacific/Fakaofo':
            case 'Pacific/Fiji':
                $this->settings['timezone_yealink'] = "Tonga(Nukualofa)";
                $this->settings['timezone_snom'] = "TON+13";
                $this->settings['timezone_sangoma'] = "104";
                $this->settings['timezone_alcatel'] = "Pacific/Tongatapu";
                $this->settings['timezone_gigaset'] = "GMT+13.Pacific/Tongatapu";
                $this->settings['timezone_fanvil'] = "52";
                $this->settings['timezone_name_fanvil'] = "UTC+13";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "780";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
### Offset +14:00
            case 'Pacific/Apia':
            case 'Pacific/Kiritimati':
            case 'Pacific/Tongatapu':
                $this->settings['timezone_yealink'] = "Kiribati";
                $this->settings['timezone_snom'] = "TON+13";
                $this->settings['timezone_sangoma'] = "104";
                $this->settings['timezone_alcatel'] = "Pacific/Tongatapu";
                $this->settings['timezone_gigaset'] = "GMT+13.Pacific/Tongatapu";
                $this->settings['timezone_fanvil'] = "58";
                $this->settings['timezone_name_fanvil'] = "UTC+14";
                $this->settings['location_fanvil'] = "1";
                $this->settings['timezone_panasonic'] = "840";
                $this->settings['language'] = "English";
                $this->settings['language_snom'] = "English";
                $this->settings['language_sangoma'] = "0";
                $this->settings['language_alcatel'] = "en";
                $this->settings['language_gigaset'] = "en-us";
		$this->settings['language_fanvil'] = "en";
		$this->settings['language_fanvil2'] = "0";
		$this->settings['language_panasonic'] = "en";
                $this->settings['language_polycom'] = "English_United_States";
            break;
            default:
                   $this->settings['timezone_yealink'] = "GMT";
                   $this->settings['timezone_snom'] = "GBR-0";
                   $this->settings['timezone_sangoma'] = "33";
                   $this->settings['timezone_alcatel'] = "GMT";
                   $this->settings['timezone_gigaset'] = "GMT.Europe/London";
                   $this->settings['timezone_fanvil'] = "0";
                   $this->settings['timezone_name_fanvil'] = "UTC";
                   $this->settings['location_fanvil'] = "1";
                   $this->settings['timezone_panasonic'] = "0";
                   $this->settings['language'] = "English";
                   $this->settings['language_snom'] = "English";
                   $this->settings['language_sangoma'] = "0";
                   $this->settings['language_alcatel'] = "en";
                   $this->settings['language_gigaset'] = "en-us";
		   $this->settings['language_fanvil'] = "en";
		   $this->settings['language_fanvil2'] = "0";
		   $this->settings['language_panasonic'] = "en";
                   $this->settings['language_polycom'] = "English_United_States";
            break;
        }

        $timezone_cisco = preg_replace ('/(GMT[\+,\-])([0-9])$/','${1}0${2}',$this->timezone['timezone']);
        $timezone_cisco = preg_replace ('/(GMT[\+,\-])([0-9][0-9])$/','${1}${2}:00',$timezone_cisco);
        $timezone_cisco = preg_replace ('/(GMT[\+,\-])([0-9]):([0-9][0-9])$/','${1}0${2}:${3}',$timezone_cisco);

        $dbh = \FreePBX::Database();
        $sql = 'SELECT `val` FROM `kvstore_Sipsettings` where `key`="externip"';
        $public_ip = $dbh->sql($sql,"getAll",\PDO::FETCH_ASSOC);

    ##Nethesis: END##
        $replace = array(
            # These first ones have an identical field name in the object and the template.
            # This is a good thing, and should be done wherever possible.
            '{$mac}' => $this->mac,
            '{$lower_mac}' => strtolower($this->mac),
            '{$model}' => $this->model,
            '{$provisioning_type}' => $this->provisioning_type,
            '{$provisioning_path}' => $this->provisioning_path,
            '{$vlan_id}' => $this->settings['network']['vlan']['id'],
            '{$vlan_qos}' => $this->settings['network']['vlan']['qos'],
            # These are not the same.
            '{$timezone_gmtoffset}' => $this->timezone['gmtoffset'],
            '{$timezone_timezone}' => $this->timezone['timezone'],
            '{$timezone}' => $this->timezone['timezone'],
            '{$network_time_server}' => $this->settings['ntp'],
            '{$local_port}' => $this->settings['network']['local_port'],
            '{$syslog_server}' => $this->settings['network']['syslog_server'],
            #old
            '{$srvip}' => $this->settings['line'][0]['server_host'],
            '{$server.ip.1}' => $this->settings['line'][0]['server_host'],
        #Nethesis: add parameters
	    '{$public_ip}' => $public_ip[0]['val'],
            '{$ldap_base}' => $this->settings['ldap_base'],
            '{$cfalwayson}' => $cfalwayson,
            '{$cfalwaysoff}' => $cfalwaysoff,
            '{$cfbusyon}' => $cfbusyon,
            '{$cfbusyoff}' => $cfbusyoff,
            '{$cftimeouton}' => $cftimeouton,
            '{$cftimeoutoff}' => $cftimeoutoff,
            '{$call_waiting_on}' => $call_waiting_on,
            '{$call_waiting_off}' => $call_waiting_off,
            '{$call_waiting}' => isset($this->settings['call_waiting']) ? $this->settings['call_waiting'] : 0,
	    '{$default_ringtone}' => $this->settings['default_ringtone'],
            '{$dndon}' => $dndon,
            '{$dndoff}' => $dndoff,
            '{$dndtoggle}' => $dndtoggle,
            '{$pickup_direct}' => $pickup,
            '{$pickup_group}' => $pickup_group,
            '{$voicemail_number}' => $voicemail_number,
            '{$language}' => $this->settings['language'],
            '{$language_snom}' => $this->settings['language_snom'],
            '{$language_sangoma}' => $this->settings['language_sangoma'],
            '{$language_alcatel}' => $this->settings['language_alcatel'],
            '{$language_gigaset}' => $this->settings['language_gigaset'],
            '{$language_fanvil}' => $this->settings['language_fanvil'],
            '{$language_fanvil2}' => $this->settings['language_fanvil2'],
            '{$location_fanvil}' => $this->settings['location_fanvil'],
            '{$language_panasonic}' => $this->settings['language_panasonic'],
            '{$language_polycom}' => $this->settings['language_polycom'],
            '{$timezone_yealink}' => $this->settings['timezone_yealink'],
            '{$timezone_snom}' => $this->settings['timezone_snom'],
            '{$timezone_sangoma}' => $this->settings['timezone_sangoma'],
            '{$timezone_alcatel}' => $this->settings['timezone_alcatel'],
            '{$timezone_gigaset}' => $this->settings['timezone_gigaset'],
            '{$timezone_fanvil}' => $this->settings['timezone_fanvil'],
            '{$timezone_panasonic}' => $this->settings['timezone_panasonic'],
            '{$timezone_cisco}' => $timezone_cisco,
            '{$tones_country}' => $this->settings['tones_country'],
            '{$tones_scheme}' => $this->settings['tones_scheme'],
            '{$tones_sangoma}' => $this->settings['tones_sangoma'],
            '{$tones_gigaset}' => $this->settings['tones_gigaset'],
            '{$tones_fanvil}' => $this->settings['tones_fanvil'],
            '{$date_gigaset}' => date('Y-m-d_H:i:s'),
        ##Nethesis: END##
            '{$server.port.1}' => $this->settings['line'][0]['server_port']
        );
        $contents = str_replace(array_keys($replace), array_values($replace), $contents);

        if (is_array($data)) {
            //not needed I dont think
        } else {
            //Find all matched variables in the text file between "{$" and "}"
            preg_match_all('/{(\$[^{]+?)[}]/i', $contents, $match);
            //Result without brackets (but with the $ variable identifier)
            $no_brackets = array_values(array_unique($match[1]));
            //Result with brackets
            $brackets = array_values(array_unique($match[0]));
            //loop though each variable found in the text file
            foreach ($no_brackets as $variables) {
                $original_variable = $variables;
                $variables = str_replace("$", "", $variables);

                $line_exp = preg_split("/\./i", $variables);

                if ((isset($line_exp[2]) AND (($line_exp[0] == 'line') OR ($line_exp[1] == 'line')))) {
                    if ($line_exp[0] == 'line') {
                        $line = explode("|", $line_exp[1]);
                        $default = isset($line[1]) ? $line[1] : NULL;
                        $line = $line[0];
                        $key1 = $this->arraysearchrecursive($line, $this->settings['line'], 'line');
                        $var = $line_exp[2];
                    } elseif ($line_exp[1] == 'line') {
                        $line = explode("|", $line_exp[2]);
                        $default = isset($line[1]) ? $line[1] : NULL;
                        $line = $line[0];
                        $key1 = $this->arraysearchrecursive($line, $this->settings['line'], 'line');
                        $var = $line_exp[0];
                        //$this->settings['line'][$key1[0]]['ext'] = isset($this->settings['line'][$key1[0]]['username']) ? $this->settings['line'][$key1[0]]['username'] : NULL;
                    }

                    //If value (that line) wasn't found then ignore the next
                    if ($key1 !== FALSE) {
                        $data['number'] = $line;
                        $data['count'] = $line;

                        $line_settings = $this->parse_lines_hook($this->settings['line'][$key1[0]], $this->max_lines);

                        $stored = isset($line_settings[$var]) ? $line_settings[$var] : '';
                        $this->debug('Replacing {' . $original_variable . '} with ' . $stored);
                        $this->replacement_array['lines'][$line]['$' . $var] = $stored;
                        $contents = str_replace('{' . $original_variable . '}', $stored, $contents);
                    } else {
                        //Blank it?
                        $contents = str_replace('{' . $original_variable . '}', "", $contents);
                        $this->replacement_array['blanks'][$original_variable] = "";
                        $this->debug("Blanking {" . $original_variable . "}");
                    }
                }
            }
        }
        return($contents);
    }

    /**
     * NOTE: Wherever possible, try $this->DateTimeZone->getOffset(new DateTime) FIRST, which takes Daylight savings into account, too.
     * Turns a string like PST-7 or UTC+1 into a GMT offset in seconds
     * @param Send this a timezone like PST-7
     * @return Offset from GMT, in seconds (eg. -25200, =3600*-7)
     * @author Jort Bloem
     */
    private function get_gmtoffset($timezone) {
        # Divide the timezone up into it's 3 interesting parts; the sign (+/-), hours, and if they exist, minutes.
        # note that matches[0] is the entire matched string, so these 3 parts are $matches[1], [2] and [3].
        preg_match('/([\-\+])([\d]+):?(\d*)/', $timezone, $matches);
        # $matches is now an array; $matches[1] is the sign (+ or -); $matches[2] is number of hours, $matches[3] is minutes (or empty)
        return intval($matches[1] . "1") * ($matches[2] * 3600 + $matches[3] * 60);
    }

    /**
     * Turns an integer like -3600 (seconds) into a GMT offset like GMT-1
     * @param Time offset in seconds, like 3600 or -25200 or -27000
     * @return timezone (eg. GMT+1 or GMT-7 or GMT-7:30)
     * @author Jort Bloem
     */
    private function get_timezone($offset) {
        if ($offset < 0) {
            $result = "GMT-";
            $offset = abs($offset);
        } else {
            $result = "GMT+";
        }
    $result.=(int) ($offset / 3600);
        if ($result % 3600 > 0) {
            $result.=":" . (($offset % 3600) / 60);
        } else {
            $result.=":00";
        }
        return $result;
    }

    /**
     * Setup and fill in timezone data
     * @author Jort Bloem
     */
    protected function setup_timezone() {
        if (isset($this->DateTimeZone) && is_object($this->DateTimeZone)) {
            //We set this to allow phones to use Automatic DST
            $gmt_dst_fix = !$this->use_system_dst && date('I') ? 3600 : 0;
            $this->timezone = array(
                'gmtoffset' => $this->DateTimeZone->getOffset(new DateTime) - $gmt_dst_fix,
                'timezone' => $this->get_timezone($this->DateTimeZone->getOffset(new DateTime) - $gmt_dst_fix)
            );
        } else {
            throw new Exception('You Must define a valid DateTimeZone object');
        }
    }

    function debug($message) {
        if ($this->debug) {
            $this->debug_return[] = $message;
        }
    }

    function file2json($file) {
        if (file_exists($file)) {
            $json = file_get_contents($file);
            $data = json_decode($json, TRUE);
            $error = json_last_error();
            if ($error === JSON_ERROR_NONE) {
                return($data);
            } else {
                $errors = array(// Taken from http://www.php.net/manual/en/function.json-last-error.php
                    JSON_ERROR_NONE => 'No error has occurred',
                    JSON_ERROR_DEPTH => 'The maximum stack depth has been exceeded',
                    JSON_ERROR_STATE_MISMATCH => 'Invalid or malformed JSON',
                    JSON_ERROR_CTRL_CHAR => 'Control character error, possibly incorrectly encoded',
                    JSON_ERROR_SYNTAX => 'Syntax error',
                    JSON_ERROR_UTF8 => 'Malformed UTF-8 characters, possibly incorrectly encoded'
                );
                if (array_key_exists($error, $errors)) {
                    $error = $errors[$error];
                } else {
                    $error = "Unknown error $error";
                }
                throw new Exception("Could not decode $file: $error");
            }
        } else {
            throw new Exception("Could not load: " . $file);
        }
    }

    private function generate_info($file_contents) {
        if ($this->server_type == "file") {
            $file_contents = str_replace('{$provisioner_generated_timestamp}', date('l jS \of F Y h:i:s A'), $file_contents);
        } else {
            $file_contents = str_replace('{$provisioner_generated_timestamp}', 'N/A (Prevents reboot loops if set to static value)', $file_contents);
        }
        $file_contents = str_replace('{$provisioner_processor_info}', $this->processor_info, $file_contents);
        $file_contents = str_replace('{$provisioner_timestamp}', $this->processor_info, $file_contents);
        $file_contents = str_replace('{$provisioner_brand_timestamp}', $this->brand_data['data']['brands']['last_modified'] . " (" . date('l jS \of F Y h:i:s A', $this->brand_data['data']['brands']['last_modified']) . ")", $file_contents);
        $file_contents = str_replace('{$provisioner_family_timestamp}', $this->brand_data['data']['brands']['last_modified'] . " (" . date('l jS \of F Y h:i:s A', $this->brand_data['data']['brands']['last_modified']) . ")", $file_contents);
        return($file_contents);
    }

    private function initialize() {
        if (!$this->initialized) {
            //Check Mac address
            if (empty($this->mac)) {
                throw new Exception("Mac Can Not Be Blank!");
            }

            //First check to see if line data is filled for at least the first line
            if (!isset($this->settings['line'][0])) {
                throw new Exception('No Line Data Defined!');
            } else {
                foreach ($this->settings['line'] as $linedata) {
                    if (!isset($linedata['line'])) {
                        throw new Exception('Line not defined!');
                    }
                }
            }

            if (!isset($this->processor_info)) {
                throw new Exception('Undefined Processor, please set your processor_info');
            }
            //Load files for quicker processing
            $this->family_data = $this->file2json($this->root_dir . $this->modules_path . $this->brand_name . "/" . $this->family_line . "/family_data.json");
            $this->brand_data = $this->file2json($this->root_dir . $this->modules_path . $this->brand_name . "/brand_data.json");

            $this->model_data = $this->find_model($this->family_data);
            $this->max_lines = isset($this->model_data['lines']) ? $this->model_data['lines'] : 1;

            $this->template_data = $this->merge_files();

            $this->setup_timezone();

            if (empty($this->engine_location)) {
                if ($this->engine == 'asterisk') {
                    $this->engine_location = 'asterisk';
                } elseif ($this->engine == 'freeswitch') {
                    $this->engine_location = 'freeswitch';
                }
            }

            //TODO: fix NTP
            if (!isset($this->settings['ntp'])) {
                $this->settings['ntp'] = $this->settings['line'][0]['server_host'];
            }

            $this->server_type = (isset($this->settings['provision']['type']) && in_array($this->settings['provision']['type'], $this->server_type_list)) ? $this->settings['provision']['type'] : $this->default_server_type;
            $this->provisioning_type = (isset($this->settings['provision']['protocol']) && in_array($this->settings['provision']['protocol'], $this->provisioning_type_list)) ? $this->settings['provision']['protocol'] : $this->default_provisioning_type;
            $this->provisioning_path = isset($this->settings['provision']['path']) ? $this->settings['provision']['path'] : $this->provisioning_path;

            $this->settings['network']['connection_type'] = isset($this->settings['network']['connection_type']) ? $this->settings['network']['connection_type'] : 'DHCP';
            $this->settings['network']['ipv4'] = isset($this->settings['network']['ipv4']) ? $this->settings['network']['ipv4'] : '';
            $this->settings['network']['ipv6'] = isset($this->settings['network']['ipv6']) ? $this->settings['network']['ipv6'] : '';
            $this->settings['network']['subnet'] = isset($this->settings['network']['subnet']) ? $this->settings['network']['subnet'] : '';
            $this->settings['network']['gateway'] = isset($this->settings['network']['gateway']) ? $this->settings['network']['gateway'] : '';
            $this->settings['network']['primary_dns'] = isset($this->settings['network']['primary_dns']) ? $this->settings['network']['primary_dns'] : '';
            $this->settings['network']['ppoe_username'] = isset($this->settings['network']['ppoe_username']) ? $this->settings['network']['ppoe_username'] : '';
            $this->settings['network']['ppoe_password'] = isset($this->settings['network']['ppoe_password']) ? $this->settings['network']['ppoe_password'] : '';
            $this->settings['network']['syslog_server'] = isset($this->settings['network']['syslog_server']) ? $this->settings['network']['syslog_server'] : '';

            //TODO:fix
            if (!isset($this->settings['network']['vlan']['id'])) {
                $this->settings['network']['vlan']['id'] = 0;
            }
            if (!isset($this->settings['network']['vlan']['qos'])) {
                $this->settings['network']['vlan']['qos'] = 5;
            }

            $this->initialized = TRUE;
        }
    }

    /**
     * Merge two arrays only if the old array is an array, otherwise just return the new array
     * @param array $array_old
     * @param array $array_new
     * @return array
     * @deprecated
     */
    function array_merge_check($array_old, $array_new) {
        if (is_array($array_old)) {
            return(array_merge($array_old, $array_new));
        } else {
            return($array_new);
        }
    }

    /**
     * Search Recursively through an array
     * @param string $Needle
     * @param array $Haystack
     * @param string $NeedleKey
     * @param boolean $Strict
     * @param array $Path
     * @return array
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

    function sys_get_temp_dir() {
        if (!empty($_ENV['TMP'])) {
            return realpath($_ENV['TMP']);
        }
        if (!empty($_ENV['TMPDIR'])) {
            return realpath($_ENV['TMPDIR']);
        }
        if (!empty($_ENV['TEMP'])) {
            return realpath($_ENV['TEMP']);
        }
        $tempfile = tempnam(uniqid(rand(), TRUE), '');
        if (file_exists($tempfile)) {
            unlink($tempfile);
            return realpath(dirname($tempfile));
        }
    }

}

//This Class is for checking for global files, which in the case of a provisioner shouldn't really need to exist, but some phones need these so we generate blanks

class Provisioner_Globals {

    /**
     * List all global files as reg statements here.
     * This should be called statically eg: $data=Provisioner_Globals:dynamic_global_files($filename);
     * Return data for global if valid
     * else just return false (eg file does not exist)
     * @param String $filename Name of the file: eg aastra.cfg
     * @return String, data of that file: eg # This file intentionally left blank!
     */
    function dynamic_global_files($file, $provisioner_path='/tmp/', $web_path='/') {
        if (preg_match("/y[0]{11}[1-7].cfg/i", $file)) {
            $file = 'y000000000000.cfg';
        }
    if (preg_match("/dialplan\.xml/i",$file)) {
        return('<DIALTEMPLATE><TEMPLATE MATCH="*" Timeout="5"/></DIALTEMPLATE>');
    }
        if (preg_match("/spa.*.cfg/i", $file)) {
            $file = 'spa.cfg';
        }
        switch ($file) {
            //spa-cisco-linksys
            case 'spa.cfg':
                return("<flat-profile>
                    <!-- The Phone will load up this file first -->
                    <!-- Don't put anything else into this file except the two lines below!! It will never be referenced again! -->
                    <!-- Trick the Phone into loading a specific file for JUST that phone -->
                    <!-- Set the resync to 3 second2 so it reboots automatically, we set this to 86400 seconds in the other file -->
                    <Resync_Periodic>3</Resync_Periodic>
                    <Profile_Rule>" . $web_path . "spa\$MA.xml</Profile_Rule>
                    <Text_Logo group=\"Phone/General\">~PLEASE WAIT~</Text_Logo>
                    <Select_Background_Picture ua=\"ro\">Text Logo</Select_Background_Picture>
                </flat-profile>");
                break;
            //yealink
            case 'y000000000000.cfg':
                return("#left blank");
                break;
            //aastra
            case "aastra.cfg":
                return("#left blank");
                break;
            default:
                if (file_exists($provisioner_path . $file)) {
                    header('Content-Description: File Transfer');
                    header('Content-Type: application/octet-stream');
                    header('Content-Disposition: attachment; filename=' . basename($provisioner_path . $file));
                    header('Content-Transfer-Encoding: binary');
                    header('Expires: 0');
                    header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
                    header('Pragma: public');
                    header('Content-Length: ' . filesize($provisioner_path . $file));
                    ob_clean();
                    flush();
                    readfile($provisioner_path . $file);
                    return('empty');
                } else {
                    return(FALSE);
                }
                break;
        }
    }

}

if (!class_exists('InvalidArgumentException')) {

    class InvalidArgumentException extends Exception {

    }

}

class InvalidObjectException extends Exception {

}
