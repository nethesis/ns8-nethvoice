<?php

/**
 * Sangoma In Production Modules Phone File
 *
 * @author Andrea Marchionni
 * @license MPL / GPLv2 / LGPL
 * @package Nethesis
 */
class endpoint_sangoma_S7xx_phone extends endpoint_sangoma_base {

    public $family_line = 'S7xx';
    protected $use_system_dst = FALSE;

    function parse_lines_hook($line_data, $line_total) {
	$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $line_data['line_active'] = 1;
        $line_data['line_m1'] = $line_data['line'];
	$line_data['pickup_value'] = isset($this->settings['pickup_value']) ? $this->settings['pickup_value'] : $this->settings['call_pickup'];

        return($line_data);
    }

    function prepare_for_generateconfig() {
	$this->settings['call_pickup'] = isset($this->settings['call_pickup']) ? $this->settings['call_pickup'] : '*8';
        $this->mac = strtolower($this->mac);
        $this->config_file_replacements['$username'] = $this->settings['line']['0']['username'];
        parent::prepare_for_generateconfig();
        
	//Set default ring tone
        if (!isset($this->settings['default_ringtone'])) {
            $this->settings['default_ringtone'] = "1";
        }

        //Set line key defaults
        $s = $this->max_lines;
        for ($i = 1; $i <= 3; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "type" => "1",
                    "line" => "0",
                );
            }
        }
        for ($i = 1; $i <= $s; $i++) {
            if (!isset($this->settings['loops']['linekey'][$i])) {
                $this->settings['loops']['linekey'][$i] = array(
                    "type" => "0",
                    "line" => "0",
                );
            }
        }
 	$sangoma_functionkeys = $this->settings['loops']['linekey'];

        $this->settings['loops']['linekey']['1'] = array (
		"type"    => "<P41200 para=\"LineKey1.Type\">".$sangoma_functionkeys['1']['type']."</P41200>",
 		"mode"    => "<P20600 para=\"LineKey1.Mode\">0</P20600>",
		"value"   => "<P41300 para=\"LineKey1.Value\">".$sangoma_functionkeys['1']['value']."</P41300>",
		"label"   => "<P41400 para=\"LineKey1.Label\">".$sangoma_functionkeys['1']['label']."</P41400>",
		"line"    => "<P41500 para=\"LineKey1.Account\">".$sangoma_functionkeys['1']['line']."</P41500>",
		"pickup"  => "<P41600 para=\"LineKey1.PickupCode\">".$sangoma_functionkeys['1']['pickup']."</P41600>"
	);	
        $this->settings['loops']['linekey']['2'] = array (
                "type"    => "<P41201 para=\"LineKey2.Type\">".$sangoma_functionkeys['2']['type']."</P41201>",
                "mode"    => "<P20601 para=\"LineKey2.Mode\">0</P20601>",
                "value"   => "<P41301 para=\"LineKey2.Value\">".$sangoma_functionkeys['2']['value']."</P41301>",
                "label"   => "<P41401 para=\"LineKey2.Label\">".$sangoma_functionkeys['2']['label']."</P41401>",
                "line"    => "<P41501 para=\"LineKey2.Account\">".$sangoma_functionkeys['2']['line']."</P41501>",
                "pickup"  => "<P41601 para=\"LineKey2.PickupCode\">".$sangoma_functionkeys['2']['pickup']."</P41601>"
        );      
        $this->settings['loops']['linekey']['3'] = array (
                "type"    => "<P41202 para=\"LineKey3.Type\">".$sangoma_functionkeys['3']['type']."</P41202>",
                "mode"    => "<P20602 para=\"LineKey3.Mode\">0</P20602>",
                "value"   => "<P41302 para=\"LineKey3.Value\">".$sangoma_functionkeys['3']['value']."</P41302>",
                "label"   => "<P41402 para=\"LineKey3.Label\">".$sangoma_functionkeys['3']['label']."</P41402>",
                "line"    => "<P41502 para=\"LineKey3.Account\">".$sangoma_functionkeys['3']['line']."</P41502>",
                "pickup"  => "<P41602 para=\"LineKey3.PickupCode\">".$sangoma_functionkeys['3']['pickup']."</P41602>"
        );      
        $this->settings['loops']['linekey']['4'] = array (
                "type"    => "<P41203 para=\"LineKey4.Type\">".$sangoma_functionkeys['4']['type']."</P41203>",
                "mode"    => "<P20603 para=\"LineKey4.Mode\">0</P20603>",
                "value"   => "<P41303 para=\"LineKey4.Value\">".$sangoma_functionkeys['4']['value']."</P41303>",
                "label"   => "<P41403 para=\"LineKey4.Label\">".$sangoma_functionkeys['4']['label']."</P41403>",
                "line"    => "<P41503 para=\"LineKey4.Account\">".$sangoma_functionkeys['4']['line']."</P41503>",
                "pickup"  => "<P41603 para=\"LineKey4.PickupCode\">".$sangoma_functionkeys['4']['pickup']."</P41603>"
        );      
        $this->settings['loops']['linekey']['5'] = array (
		"type"    => "<P20200 para=\"LineKey5.Type\">".$sangoma_functionkeys['5']['type']."</P20200>",
 		"mode"    => "<P20604 para=\"LineKey5.Mode\">0</P20604>",
		"value"   => "<P20201 para=\"LineKey5.Value\">".$sangoma_functionkeys['5']['value']."</P20201>",
		"label"   => "<P20202 para=\"LineKey5.Label\">".$sangoma_functionkeys['5']['label']."</P20202>",
		"line"    => "<P20203 para=\"LineKey5.Account\">".$sangoma_functionkeys['5']['line']."</P20203>",
		"pickup"  => "<P20204 para=\"LineKey5.PickupCode\">".$sangoma_functionkeys['5']['pickup']."</P20204>"
	);	
        $this->settings['loops']['linekey']['6'] = array (
		"type"    => "<P20205 para=\"LineKey6.Type\">".$sangoma_functionkeys['6']['type']."</P20205>",
 		"mode"    => "<P20605 para=\"LineKey6.Mode\">0</P20605>",
		"value"   => "<P20206 para=\"LineKey6.Value\">".$sangoma_functionkeys['6']['value']."</P20206>",
		"label"   => "<P20207 para=\"LineKey6.Label\">".$sangoma_functionkeys['6']['label']."</P20207>",
		"line"    => "<P20208 para=\"LineKey6.Account\">".$sangoma_functionkeys['6']['line']."</P20208>",
		"pickup"  => "<P20209 para=\"LineKey6.PickupCode\">".$sangoma_functionkeys['6']['pickup']."</P20209>"
	);	
        $this->settings['loops']['linekey']['7'] = array (
		"type"    => "<P20210 para=\"LineKey7.Type\">".$sangoma_functionkeys['7']['type']."</P20210>",
 		"mode"    => "<P20606 para=\"LineKey7.Mode\">0</P20606>",
		"value"   => "<P20211 para=\"LineKey7.Value\">".$sangoma_functionkeys['7']['value']."</P20211>",
		"label"   => "<P20212 para=\"LineKey7.Label\">".$sangoma_functionkeys['7']['label']."</P20212>",
		"line"    => "<P20213 para=\"LineKey7.Account\">".$sangoma_functionkeys['7']['line']."</P20213>",
		"pickup"  => "<P20214 para=\"LineKey7.PickupCode\">".$sangoma_functionkeys['7']['pickup']."</P20214>"
	);	
        $this->settings['loops']['linekey']['8'] = array (
		"type"    => "<P20215 para=\"LineKey8.Type\">".$sangoma_functionkeys['8']['type']."</P20215>",
 		"mode"    => "<P20607 para=\"LineKey8.Mode\">0</P20607>",
		"value"   => "<P20216 para=\"LineKey8.Value\">".$sangoma_functionkeys['8']['value']."</P20216>",
		"label"   => "<P20217 para=\"LineKey8.Label\">".$sangoma_functionkeys['8']['label']."</P20217>",
		"line"    => "<P20218 para=\"LineKey8.Account\">".$sangoma_functionkeys['8']['line']."</P20218>",
		"pickup"  => "<P20219 para=\"LineKey8.PickupCode\">".$sangoma_functionkeys['8']['pickup']."</P20219>"
	);	
        $this->settings['loops']['linekey']['9'] = array (
		"type"    => "<P20220 para=\"LineKey9.Type\">".$sangoma_functionkeys['9']['type']."</P20220>",
 		"mode"    => "<P20608 para=\"LineKey9.Mode\">0</P20608>",
		"value"   => "<P20221 para=\"LineKey9.Value\">".$sangoma_functionkeys['9']['value']."</P20221>",
		"label"   => "<P20222 para=\"LineKey9.Label\">".$sangoma_functionkeys['9']['label']."</P20222>",
		"line"    => "<P20223 para=\"LineKey9.Account\">".$sangoma_functionkeys['9']['line']."</P20223>",
		"pickup"  => "<P20224 para=\"LineKey9.PickupCode\">".$sangoma_functionkeys['9']['pickup']."</P20224>"
	);	
        $this->settings['loops']['linekey']['10'] = array (
		"type"    => "<P20225 para=\"LineKey10.Type\">".$sangoma_functionkeys['10']['type']."</P20225>",
 		"mode"    => "<P20609 para=\"LineKey10.Mode\">0</P20609>",
		"value"   => "<P20226 para=\"LineKey10.Value\">".$sangoma_functionkeys['10']['value']."</P20226>",
		"label"   => "<P20227 para=\"LineKey10.Label\">".$sangoma_functionkeys['10']['label']."</P20227>",
		"line"    => "<P20228 para=\"LineKey10.Account\">".$sangoma_functionkeys['10']['line']."</P20228>",
		"pickup"  => "<P20229 para=\"LineKey10.PickupCode\">".$sangoma_functionkeys['10']['pickup']."</P20229>"
	);	
        $this->settings['loops']['linekey']['11'] = array (
		"type"    => "<P20230 para=\"LineKey11.Type\">".$sangoma_functionkeys['11']['type']."</P20230>",
 		"mode"    => "<P20610 para=\"LineKey11.Mode\">0</P20610>",
		"value"   => "<P20231 para=\"LineKey11.Value\">".$sangoma_functionkeys['11']['value']."</P20231>",
		"label"   => "<P20232 para=\"LineKey11.Label\">".$sangoma_functionkeys['11']['label']."</P20232>",
		"line"    => "<P20233 para=\"LineKey11.Account\">".$sangoma_functionkeys['11']['line']."</P20233>",
		"pickup"  => "<P20234 para=\"LineKey11.PickupCode\">".$sangoma_functionkeys['11']['pickup']."</P20234>"
	);	
        $this->settings['loops']['linekey']['11'] = array (
		"type"    => "<P20230 para=\"LineKey11.Type\">".$sangoma_functionkeys['11']['type']."</P20230>",
 		"mode"    => "<P20610 para=\"LineKey11.Mode\">0</P20610>",
		"value"   => "<P20231 para=\"LineKey11.Value\">".$sangoma_functionkeys['11']['value']."</P20231>",
		"label"   => "<P20232 para=\"LineKey11.Label\">".$sangoma_functionkeys['11']['label']."</P20232>",
		"line"    => "<P20233 para=\"LineKey11.Account\">".$sangoma_functionkeys['11']['line']."</P20233>",
		"pickup"  => "<P20234 para=\"LineKey11.PickupCode\">".$sangoma_functionkeys['11']['pickup']."</P20234>"
	);	
        $this->settings['loops']['linekey']['12'] = array (
		"type"    => "<P20235 para=\"LineKey12.Type\">".$sangoma_functionkeys['12']['type']."</P20235>",
 		"mode"    => "<P20611 para=\"LineKey12.Mode\">0</P20611>",
		"value"   => "<P20236 para=\"LineKey12.Value\">".$sangoma_functionkeys['12']['value']."</P20236>",
		"label"   => "<P20237 para=\"LineKey12.Label\">".$sangoma_functionkeys['12']['label']."</P20237>",
		"line"    => "<P20238 para=\"LineKey12.Account\">".$sangoma_functionkeys['12']['line']."</P20238>",
		"pickup"  => "<P20239 para=\"LineKey12.PickupCode\">".$sangoma_functionkeys['12']['pickup']."</P20239>"
	);	
        $this->settings['loops']['linekey']['13'] = array (
		"type"    => "<P20240 para=\"LineKey13.Type\">".$sangoma_functionkeys['13']['type']."</P20240>",
 		"mode"    => "<P20612 para=\"LineKey13.Mode\">0</P20612>",
		"value"   => "<P20241 para=\"LineKey13.Value\">".$sangoma_functionkeys['13']['value']."</P20241>",
		"label"   => "<P20242 para=\"LineKey13.Label\">".$sangoma_functionkeys['13']['label']."</P20242>",
		"line"    => "<P20243 para=\"LineKey13.Account\">".$sangoma_functionkeys['13']['line']."</P20243>",
		"pickup"  => "<P20244 para=\"LineKey13.PickupCode\">".$sangoma_functionkeys['13']['pickup']."</P20244>"
	);	
        $this->settings['loops']['linekey']['14'] = array (
		"type"    => "<P20245 para=\"LineKey14.Type\">".$sangoma_functionkeys['14']['type']."</P20245>",
 		"mode"    => "<P20613 para=\"LineKey14.Mode\">0</P20613>",
		"value"   => "<P20246 para=\"LineKey14.Value\">".$sangoma_functionkeys['14']['value']."</P20246>",
		"label"   => "<P20247 para=\"LineKey14.Label\">".$sangoma_functionkeys['14']['label']."</P20247>",
		"line"    => "<P20248 para=\"LineKey14.Account\">".$sangoma_functionkeys['14']['line']."</P20248>",
		"pickup"  => "<P20249 para=\"LineKey14.PickupCode\">".$sangoma_functionkeys['14']['pickup']."</P20249>"
	);	
        $this->settings['loops']['linekey']['15'] = array (
		"type"    => "<P20250 para=\"LineKey15.Type\">".$sangoma_functionkeys['15']['type']."</P20250>",
 		"mode"    => "<P20614 para=\"LineKey15.Mode\">0</P20614>",
		"value"   => "<P20251 para=\"LineKey15.Value\">".$sangoma_functionkeys['15']['value']."</P20251>",
		"label"   => "<P20252 para=\"LineKey15.Label\">".$sangoma_functionkeys['15']['label']."</P20252>",
		"line"    => "<P20253 para=\"LineKey15.Account\">".$sangoma_functionkeys['15']['line']."</P20253>",
		"pickup"  => "<P20254 para=\"LineKey15.PickupCode\">".$sangoma_functionkeys['15']['pickup']."</P20254>"
	);	
        $this->settings['loops']['linekey']['16'] = array (
		"type"    => "<P20255 para=\"LineKey16.Type\">".$sangoma_functionkeys['16']['type']."</P20255>",
 		"mode"    => "<P20615 para=\"LineKey16.Mode\">0</P20615>",
		"value"   => "<P20256 para=\"LineKey16.Value\">".$sangoma_functionkeys['16']['value']."</P20256>",
		"label"   => "<P20257 para=\"LineKey16.Label\">".$sangoma_functionkeys['16']['label']."</P20257>",
		"line"    => "<P20258 para=\"LineKey16.Account\">".$sangoma_functionkeys['16']['line']."</P20258>",
		"pickup"  => "<P20259 para=\"LineKey16.PickupCode\">".$sangoma_functionkeys['16']['pickup']."</P20259>"
	);	
        $this->settings['loops']['linekey']['17'] = array (
		"type"    => "<P20260 para=\"LineKey17.Type\">".$sangoma_functionkeys['17']['type']."</P20260>",
 		"mode"    => "<P20616 para=\"LineKey17.Mode\">0</P20616>",
		"value"   => "<P20261 para=\"LineKey17.Value\">".$sangoma_functionkeys['17']['value']."</P20261>",
		"label"   => "<P20262 para=\"LineKey17.Label\">".$sangoma_functionkeys['17']['label']."</P20262>",
		"line"    => "<P20263 para=\"LineKey17.Account\">".$sangoma_functionkeys['17']['line']."</P20263>",
		"pickup"  => "<P20264 para=\"LineKey17.PickupCode\">".$sangoma_functionkeys['17']['pickup']."</P20264>"
	);	
        $this->settings['loops']['linekey']['18'] = array (
		"type"    => "<P20265 para=\"LineKey18.Type\">".$sangoma_functionkeys['18']['type']."</P20265>",
 		"mode"    => "<P20617 para=\"LineKey18.Mode\">0</P20617>",
		"value"   => "<P20266 para=\"LineKey18.Value\">".$sangoma_functionkeys['18']['value']."</P20266>",
		"label"   => "<P20267 para=\"LineKey18.Label\">".$sangoma_functionkeys['18']['label']."</P20267>",
		"line"    => "<P20268 para=\"LineKey18.Account\">".$sangoma_functionkeys['18']['line']."</P20268>",
		"pickup"  => "<P20269 para=\"LineKey18.PickupCode\">".$sangoma_functionkeys['18']['pickup']."</P20269>"
	);	
        $this->settings['loops']['linekey']['19'] = array (
		"type"    => "<P20270 para=\"LineKey19.Type\">".$sangoma_functionkeys['19']['type']."</P20270>",
 		"mode"    => "<P20618 para=\"LineKey19.Mode\">0</P20618>",
		"value"   => "<P20271 para=\"LineKey19.Value\">".$sangoma_functionkeys['19']['value']."</P20271>",
		"label"   => "<P20272 para=\"LineKey19.Label\">".$sangoma_functionkeys['19']['label']."</P20272>",
		"line"    => "<P20273 para=\"LineKey19.Account\">".$sangoma_functionkeys['19']['line']."</P20273>",
		"pickup"  => "<P20274 para=\"LineKey19.PickupCode\">".$sangoma_functionkeys['19']['pickup']."</P20274>"
	);	
        $this->settings['loops']['linekey']['20'] = array (
		"type"    => "<P20275 para=\"LineKey20.Type\">".$sangoma_functionkeys['20']['type']."</P20275>",
 		"mode"    => "<P20619 para=\"LineKey20.Mode\">0</P20619>",
		"value"   => "<P20276 para=\"LineKey20.Value\">".$sangoma_functionkeys['20']['value']."</P20276>",
		"label"   => "<P20277 para=\"LineKey20.Label\">".$sangoma_functionkeys['20']['label']."</P20277>",
		"line"    => "<P20278 para=\"LineKey20.Account\">".$sangoma_functionkeys['20']['line']."</P20278>",
		"pickup"  => "<P20279 para=\"LineKey20.PickupCode\">".$sangoma_functionkeys['20']['pickup']."</P20279>"
	);	
        $this->settings['loops']['linekey']['21'] = array (
		"type"    => "<P20280 para=\"LineKey21.Type\">".$sangoma_functionkeys['21']['type']."</P20280>",
 		"mode"    => "<P20620 para=\"LineKey21.Mode\">0</P20620>",
		"value"   => "<P20281 para=\"LineKey21.Value\">".$sangoma_functionkeys['21']['value']."</P20281>",
		"label"   => "<P20282 para=\"LineKey21.Label\">".$sangoma_functionkeys['21']['label']."</P20282>",
		"line"    => "<P20283 para=\"LineKey21.Account\">".$sangoma_functionkeys['21']['line']."</P20283>",
		"pickup"  => "<P20284 para=\"LineKey21.PickupCode\">".$sangoma_functionkeys['21']['pickup']."</P20284>"
	);	
        $this->settings['loops']['linekey']['22'] = array (
		"type"    => "<P20285 para=\"LineKey22.Type\">".$sangoma_functionkeys['22']['type']."</P20285>",
 		"mode"    => "<P20621 para=\"LineKey22.Mode\">0</P20621>",
		"value"   => "<P20286 para=\"LineKey22.Value\">".$sangoma_functionkeys['22']['value']."</P20286>",
		"label"   => "<P20287 para=\"LineKey22.Label\">".$sangoma_functionkeys['22']['label']."</P20287>",
		"line"    => "<P20288 para=\"LineKey22.Account\">".$sangoma_functionkeys['22']['line']."</P20288>",
		"pickup"  => "<P20289 para=\"LineKey22.PickupCode\">".$sangoma_functionkeys['22']['pickup']."</P20289>"
	);	
        $this->settings['loops']['linekey']['23'] = array (
		"type"    => "<P20290 para=\"LineKey23.Type\">".$sangoma_functionkeys['23']['type']."</P20290>",
 		"mode"    => "<P20622 para=\"LineKey23.Mode\">0</P20622>",
		"value"   => "<P20291 para=\"LineKey23.Value\">".$sangoma_functionkeys['23']['value']."</P20291>",
		"label"   => "<P20292 para=\"LineKey23.Label\">".$sangoma_functionkeys['23']['label']."</P20292>",
		"line"    => "<P20293 para=\"LineKey23.Account\">".$sangoma_functionkeys['23']['line']."</P20293>",
		"pickup"  => "<P20294 para=\"LineKey23.PickupCode\">".$sangoma_functionkeys['23']['pickup']."</P20294>"
	);	
        $this->settings['loops']['linekey']['24'] = array (
		"type"    => "<P20295 para=\"LineKey24.Type\">".$sangoma_functionkeys['24']['type']."</P20295>",
 		"mode"    => "<P20623 para=\"LineKey24.Mode\">0</P20623>",
		"value"   => "<P20296 para=\"LineKey24.Value\">".$sangoma_functionkeys['24']['value']."</P20296>",
		"label"   => "<P20297 para=\"LineKey24.Label\">".$sangoma_functionkeys['24']['label']."</P20297>",
		"line"    => "<P20298 para=\"LineKey24.Account\">".$sangoma_functionkeys['24']['line']."</P20298>",
		"pickup"  => "<P20299 para=\"LineKey24.PickupCode\">".$sangoma_functionkeys['24']['pickup']."</P20299>"
	);	
        $this->settings['loops']['linekey']['25'] = array (
		"type"    => "<P20300 para=\"LineKey25.Type\">".$sangoma_functionkeys['25']['type']."</P20300>",
 		"mode"    => "<P20624 para=\"LineKey25.Mode\">0</P20624>",
		"value"   => "<P20301 para=\"LineKey25.Value\">".$sangoma_functionkeys['25']['value']."</P20301>",
		"label"   => "<P20302 para=\"LineKey25.Label\">".$sangoma_functionkeys['25']['label']."</P20302>",
		"line"    => "<P20303 para=\"LineKey25.Account\">".$sangoma_functionkeys['25']['line']."</P20303>",
		"pickup"  => "<P20304 para=\"LineKey25.PickupCode\">".$sangoma_functionkeys['25']['pickup']."</P20304>"
	);	
        $this->settings['loops']['linekey']['26'] = array (
		"type"    => "<P20305 para=\"LineKey26.Type\">".$sangoma_functionkeys['26']['type']."</P20305>",
 		"mode"    => "<P20625 para=\"LineKey26.Mode\">0</P20625>",
		"value"   => "<P20306 para=\"LineKey26.Value\">".$sangoma_functionkeys['26']['value']."</P20306>",
		"label"   => "<P20307 para=\"LineKey26.Label\">".$sangoma_functionkeys['26']['label']."</P20307>",
		"line"    => "<P20308 para=\"LineKey26.Account\">".$sangoma_functionkeys['26']['line']."</P20308>",
		"pickup"  => "<P20309 para=\"LineKey26.PickupCode\">".$sangoma_functionkeys['26']['pickup']."</P20309>"
	);	
        $this->settings['loops']['linekey']['27'] = array (
		"type"    => "<P20310 para=\"LineKey27.Type\">".$sangoma_functionkeys['27']['type']."</P20310>",
 		"mode"    => "<P20626 para=\"LineKey27.Mode\">0</P20626>",
		"value"   => "<P20311 para=\"LineKey27.Value\">".$sangoma_functionkeys['27']['value']."</P20311>",
		"label"   => "<P20312 para=\"LineKey27.Label\">".$sangoma_functionkeys['27']['label']."</P20312>",
		"line"    => "<P20313 para=\"LineKey27.Account\">".$sangoma_functionkeys['27']['line']."</P20313>",
		"pickup"  => "<P20314 para=\"LineKey27.PickupCode\">".$sangoma_functionkeys['27']['pickup']."</P20314>"
	);	
        $this->settings['loops']['linekey']['28'] = array (
		"type"    => "<P20315 para=\"LineKey28.Type\">".$sangoma_functionkeys['28']['type']."</P20315>",
 		"mode"    => "<P20627 para=\"LineKey28.Mode\">0</P20627>",
		"value"   => "<P20316 para=\"LineKey28.Value\">".$sangoma_functionkeys['28']['value']."</P20316>",
		"label"   => "<P20317 para=\"LineKey28.Label\">".$sangoma_functionkeys['28']['label']."</P20317>",
		"line"    => "<P20318 para=\"LineKey28.Account\">".$sangoma_functionkeys['28']['line']."</P20318>",
		"pickup"  => "<P20319 para=\"LineKey28.PickupCode\">".$sangoma_functionkeys['28']['pickup']."</P20319>"
	);	
        $this->settings['loops']['linekey']['29'] = array (
		"type"    => "<P20320 para=\"LineKey29.Type\">".$sangoma_functionkeys['29']['type']."</P20320>",
 		"mode"    => "<P20628 para=\"LineKey29.Mode\">0</P20628>",
		"value"   => "<P20321 para=\"LineKey29.Value\">".$sangoma_functionkeys['29']['value']."</P20321>",
		"label"   => "<P20322 para=\"LineKey29.Label\">".$sangoma_functionkeys['29']['label']."</P20322>",
		"line"    => "<P20323 para=\"LineKey29.Account\">".$sangoma_functionkeys['29']['line']."</P20323>",
		"pickup"  => "<P20324 para=\"LineKey29.PickupCode\">".$sangoma_functionkeys['29']['pickup']."</P20324>"
	);	
        $this->settings['loops']['linekey']['30'] = array (
		"type"    => "<P20325 para=\"LineKey30.Type\">".$sangoma_functionkeys['30']['type']."</P20325>",
 		"mode"    => "<P20629 para=\"LineKey30.Mode\">0</P20629>",
		"value"   => "<P20326 para=\"LineKey30.Value\">".$sangoma_functionkeys['30']['value']."</P20326>",
		"label"   => "<P20327 para=\"LineKey30.Label\">".$sangoma_functionkeys['30']['label']."</P20327>",
		"line"    => "<P20328 para=\"LineKey30.Account\">".$sangoma_functionkeys['30']['line']."</P20328>",
		"pickup"  => "<P20329 para=\"LineKey30.PickupCode\">".$sangoma_functionkeys['30']['pickup']."</P20329>"
	);	
        $this->settings['loops']['linekey']['31'] = array (
		"type"    => "<P20330 para=\"LineKey31.Type\">".$sangoma_functionkeys['31']['type']."</P20330>",
 		"mode"    => "<P20630 para=\"LineKey31.Mode\">0</P20630>",
		"value"   => "<P20331 para=\"LineKey31.Value\">".$sangoma_functionkeys['31']['value']."</P20331>",
		"label"   => "<P20332 para=\"LineKey31.Label\">".$sangoma_functionkeys['31']['label']."</P20332>",
		"line"    => "<P20333 para=\"LineKey31.Account\">".$sangoma_functionkeys['31']['line']."</P20333>",
		"pickup"  => "<P20334 para=\"LineKey31.PickupCode\">".$sangoma_functionkeys['31']['pickup']."</P20334>"
	);	
        $this->settings['loops']['linekey']['32'] = array (
		"type"    => "<P20335 para=\"LineKey32.Type\">".$sangoma_functionkeys['32']['type']."</P20335>",
 		"mode"    => "<P20631 para=\"LineKey32.Mode\">0</P20631>",
		"value"   => "<P20336 para=\"LineKey32.Value\">".$sangoma_functionkeys['32']['value']."</P20336>",
		"label"   => "<P20337 para=\"LineKey32.Label\">".$sangoma_functionkeys['32']['label']."</P20337>",
		"line"    => "<P20338 para=\"LineKey32.Account\">".$sangoma_functionkeys['32']['line']."</P20338>",
		"pickup"  => "<P20339 para=\"LineKey32.PickupCode\">".$sangoma_functionkeys['32']['pickup']."</P20339>"
	);	
        $this->settings['loops']['linekey']['33'] = array (
		"type"    => "<P20340 para=\"LineKey33.Type\">".$sangoma_functionkeys['33']['type']."</P20340>",
 		"mode"    => "<P20632 para=\"LineKey33.Mode\">0</P20632>",
		"value"   => "<P20341 para=\"LineKey33.Value\">".$sangoma_functionkeys['33']['value']."</P20341>",
		"label"   => "<P20342 para=\"LineKey33.Label\">".$sangoma_functionkeys['33']['label']."</P20342>",
		"line"    => "<P20343 para=\"LineKey33.Account\">".$sangoma_functionkeys['33']['line']."</P20343>",
		"pickup"  => "<P20344 para=\"LineKey33.PickupCode\">".$sangoma_functionkeys['33']['pickup']."</P20344>"
	);	
        $this->settings['loops']['linekey']['34'] = array (
		"type"    => "<P20345 para=\"LineKey34.Type\">".$sangoma_functionkeys['34']['type']."</P20345>",
 		"mode"    => "<P20633 para=\"LineKey34.Mode\">0</P20633>",
		"value"   => "<P20346 para=\"LineKey34.Value\">".$sangoma_functionkeys['34']['value']."</P20346>",
		"label"   => "<P20347 para=\"LineKey34.Label\">".$sangoma_functionkeys['34']['label']."</P20347>",
		"line"    => "<P20348 para=\"LineKey34.Account\">".$sangoma_functionkeys['34']['line']."</P20348>",
		"pickup"  => "<P20349 para=\"LineKey34.PickupCode\">".$sangoma_functionkeys['34']['pickup']."</P20349>"
	);	
        $this->settings['loops']['linekey']['35'] = array (
		"type"    => "<P20350 para=\"LineKey35.Type\">".$sangoma_functionkeys['35']['type']."</P20350>",
 		"mode"    => "<P20634 para=\"LineKey35.Mode\">0</P20634>",
		"value"   => "<P20351 para=\"LineKey35.Value\">".$sangoma_functionkeys['35']['value']."</P20351>",
		"label"   => "<P20352 para=\"LineKey35.Label\">".$sangoma_functionkeys['35']['label']."</P20352>",
		"line" => "<P20353 para=\"LineKey35.Account\">".$sangoma_functionkeys['35']['line']."</P20353>",
		"pickup"  => "<P20354 para=\"LineKey35.PickupCode\">".$sangoma_functionkeys['35']['pickup']."</P20354>"
	);	
        $this->settings['loops']['linekey']['36'] = array (
		"type"    => "<P20355 para=\"LineKey36.Type\">".$sangoma_functionkeys['36']['type']."</P20355>",
 		"mode"    => "<P20635 para=\"LineKey36.Mode\">0</P20635>",
		"value"   => "<P20356 para=\"LineKey36.Value\">".$sangoma_functionkeys['36']['value']."</P20356>",
		"label"   => "<P20357 para=\"LineKey36.Label\">".$sangoma_functionkeys['36']['label']."</P20357>",
		"line" => "<P20358 para=\"LineKey36.Account\">".$sangoma_functionkeys['36']['line']."</P20358>",
		"pickup"  => "<P20359 para=\"LineKey36.PickupCode\">".$sangoma_functionkeys['36']['pickup']."</P20359>"
	);	
        $this->settings['loops']['linekey']['37'] = array (
		"type"    => "<P23000 para=\"LineKey37.Type\">".$sangoma_functionkeys['37']['type']."</P23000>",
 		"mode"    => "<P23001 para=\"LineKey37.Mode\">0</P23001>",
		"value"   => "<P23002 para=\"LineKey37.Value\">".$sangoma_functionkeys['37']['value']."</P23002>",
		"label"   => "<P23003 para=\"LineKey37.Label\">".$sangoma_functionkeys['37']['label']."</P23003>",
		"line"    => "<P23004 para=\"LineKey37.Account\">".$sangoma_functionkeys['37']['line']."</P23004>",
		"pickup"  => "<P23005 para=\"LineKey37.PickupCode\">".$sangoma_functionkeys['37']['pickup']."</P23005>"
	);	
        $this->settings['loops']['linekey']['38'] = array (
		"type"    => "<P23006 para=\"LineKey38.Type\">".$sangoma_functionkeys['38']['type']."</P23006>",
 		"mode"    => "<P23007 para=\"LineKey38.Mode\">0</P23007>",
		"value"   => "<P23008 para=\"LineKey38.Value\">".$sangoma_functionkeys['38']['value']."</P23008>",
		"label"   => "<P23009 para=\"LineKey38.Label\">".$sangoma_functionkeys['38']['label']."</P23009>",
		"line"    => "<P23010 para=\"LineKey38.Account\">".$sangoma_functionkeys['38']['line']."</P23010>",
		"pickup"  => "<P23011 para=\"LineKey38.PickupCode\">".$sangoma_functionkeys['38']['pickup']."</P23011>"
	);	
        $this->settings['loops']['linekey']['39'] = array (
		"type"    => "<P23012 para=\"LineKey39.Type\">".$sangoma_functionkeys['37']['type']."</P23012>",
 		"mode"    => "<P23013 para=\"LineKey39.Mode\">0</P23013>",
		"value"   => "<P23014 para=\"LineKey39.Value\">".$sangoma_functionkeys['37']['value']."</P23014>",
		"label"   => "<P23015 para=\"LineKey39.Label\">".$sangoma_functionkeys['37']['label']."</P23015>",
		"line"    => "<P23016 para=\"LineKey39.Account\">".$sangoma_functionkeys['37']['line']."</P23016>",
		"pickup"  => "<P23017 para=\"LineKey39.PickupCode\">".$sangoma_functionkeys['37']['pickup']."</P23017>"
	);	
        $this->settings['loops']['linekey']['40'] = array (
		"type"    => "<P23018 para=\"LineKey40.Type\">".$sangoma_functionkeys['40']['type']."</P23018>",
 		"mode"    => "<P23019 para=\"LineKey40.Mode\">0</P23019>",
		"value"   => "<P23020 para=\"LineKey40.Value\">".$sangoma_functionkeys['40']['value']."</P23020>",
		"label"   => "<P23021 para=\"LineKey40.Label\">".$sangoma_functionkeys['40']['label']."</P23021>",
		"line" => "<P23022 para=\"LineKey40.Account\">".$sangoma_functionkeys['40']['line']."</P23022>",
		"pickup"  => "<P23023 para=\"LineKey40.PickupCode\">".$sangoma_functionkeys['40']['pickup']."</P23023>"
	);	
        $this->settings['loops']['linekey']['41'] = array (
		"type"    => "<P23024 para=\"LineKey41.Type\">".$sangoma_functionkeys['41']['type']."</P23024>",
 		"mode"    => "<P23025 para=\"LineKey41.Mode\">0</P23025>",
		"value"   => "<P23026 para=\"LineKey41.Value\">".$sangoma_functionkeys['41']['value']."</P23026>",
		"label"   => "<P23027 para=\"LineKey41.Label\">".$sangoma_functionkeys['41']['label']."</P23027>",
		"line"    => "<P23028 para=\"LineKey41.Account\">".$sangoma_functionkeys['41']['line']."</P23028>",
		"pickup"  => "<P23029 para=\"LineKey41.PickupCode\">".$sangoma_functionkeys['41']['pickup']."</P23029>"
	);	
        $this->settings['loops']['linekey']['42'] = array (
		"type"    => "<P23030 para=\"LineKey42.Type\">".$sangoma_functionkeys['42']['type']."</P23030>",
 		"mode"    => "<P23031 para=\"LineKey42.Mode\">0</P23031>",
		"value"   => "<P23032 para=\"LineKey42.Value\">".$sangoma_functionkeys['42']['value']."</P23032>",
		"label"   => "<P23033 para=\"LineKey42.Label\">".$sangoma_functionkeys['42']['label']."</P23033>",
		"line"    => "<P23034 para=\"LineKey42.Account\">".$sangoma_functionkeys['42']['line']."</P23034>",
		"pickup"  => "<P23035 para=\"LineKey42.PickupCode\">".$sangoma_functionkeys['42']['pickup']."</P23035>"
	);	
        $this->settings['loops']['linekey']['43'] = array (
		"type"    => "<P23036 para=\"LineKey43.Type\">".$sangoma_functionkeys['43']['type']."</P23036>",
 		"mode"    => "<P23037 para=\"LineKey43.Mode\">0</P23037>",
		"value"   => "<P23038 para=\"LineKey43.Value\">".$sangoma_functionkeys['43']['value']."</P23038>",
		"label"   => "<P23039 para=\"LineKey43.Label\">".$sangoma_functionkeys['43']['label']."</P23039>",
		"line"    => "<P23040 para=\"LineKey43.Account\">".$sangoma_functionkeys['43']['line']."</P23040>",
		"pickup"  => "<P23041 para=\"LineKey43.PickupCode\">".$sangoma_functionkeys['43']['pickup']."</P23041>"
	);	
        $this->settings['loops']['linekey']['44'] = array (
		"type"    => "<P23042 para=\"LineKey44.Type\">".$sangoma_functionkeys['44']['type']."</P23042>",
 		"mode"    => "<P23043 para=\"LineKey44.Mode\">0</P23043>",
		"value"   => "<P23044 para=\"LineKey44.Value\">".$sangoma_functionkeys['44']['value']."</P23044>",
		"label"   => "<P23045 para=\"LineKey44.Label\">".$sangoma_functionkeys['44']['label']."</P23045>",
		"line"    => "<P23046 para=\"LineKey44.Account\">".$sangoma_functionkeys['44']['line']."</P23046>",
		"pickup"  => "<P23047 para=\"LineKey44.PickupCode\">".$sangoma_functionkeys['44']['pickup']."</P23047>"
	);	
        $this->settings['loops']['linekey']['45'] = array (
		"type"    => "<P23048 para=\"LineKey45.Type\">".$sangoma_functionkeys['45']['type']."</P23048>",
 		"mode"    => "<P23049 para=\"LineKey45.Mode\">0</P23049>",
		"value"   => "<P23050 para=\"LineKey45.Value\">".$sangoma_functionkeys['45']['value']."</P23050>",
		"label"   => "<P23051 para=\"LineKey45.Label\">".$sangoma_functionkeys['45']['label']."</P23051>",
		"line"    => "<P23052 para=\"LineKey45.Account\">".$sangoma_functionkeys['45']['line']."</P23052>",
		"pickup"  => "<P23053 para=\"LineKey45.PickupCode\">".$sangoma_functionkeys['45']['pickup']."</P23053>"
	);	

        $sangoma_exp1keys = $this->settings['loops']['exp1key'];

        for ($i=1, $k=60000; $i<=40 ; $i++, $k+=5) {
                $this->settings['loops']['exp1key'][$i] = array (
                "type"    => "<P".$k." para=\"Exp1_".$i.".Type\">".$sangoma_exp1keys[$i]['type']."</P".$k.">",
                "value"   => "<P".($k+1)." para=\"Exp1_".$i.".Value\">".$sangoma_exp1keys[$i]['value']."</P".($k+1).">",
                "label"   => "<P".($k+2)." para=\"Exp1_".$i.".Label\">".$sangoma_exp1keys[$i]['label']."</P".($k+2).">",
                "line"    => "<P".($k+3)." para=\"Exp1_".$i.".Account\">".$sangoma_exp1keys[$i]['line']."</P".($k+3).">",
                "pickup"  => "<P".($k+4)." para=\"Exp1_".$i.".PickupCode\">".$sangoma_exp1keys[$i]['pickup']."</P".($k+4).">"
                );
        }

        $sangoma_exp2keys = $this->settings['loops']['exp2key'];

        for ($i=1, $k=61000; $i<=40 ; $i++, $k+=5) {
                $this->settings['loops']['exp2key'][$i] = array (
                "type"    => "<P".$k." para=\"Exp2_".$i.".Type\">".$sangoma_exp2keys[$i]['type']."</P".$k.">",
                "value"   => "<P".($k+1)." para=\"Exp2_".$i.".Value\">".$sangoma_exp2keys[$i]['value']."</P".($k+1).">",
                "label"   => "<P".($k+2)." para=\"Exp2_".$i.".Label\">".$sangoma_exp2keys[$i]['label']."</P".($k+2).">",
                "line"    => "<P".($k+3)." para=\"Exp2_".$i.".Account\">".$sangoma_exp2keys[$i]['line']."</P".($k+3).">",
                "pickup"  => "<P".($k+4)." para=\"Exp2_".$i.".PickupCode\">".$sangoma_exp2keys[$i]['pickup']."</P".($k+4).">"
                );
        }

        if (!isset($this->settings['softkey1_label'])) {
            $this->settings['softkey1_label'] = "Reg.Ch.";
        }
        if (!isset($this->settings['softkey1_type'])) {
            $this->settings['softkey1_type'] = "36";
        }
        if (!isset($this->settings['softkey2_label'])) {
            $this->settings['softkey2_label'] = "Rubrica";
        }
        if (!isset($this->settings['softkey2_type'])) {
            $this->settings['softkey2_type'] = "15";
        }
        if (!isset($this->settings['softkey3_label'])) {
            $this->settings['softkey3_label'] = "Pickup";
        }
        if (!isset($this->settings['softkey3_type'])) {
            $this->settings['softkey3_type'] = "7";
        }
        if (!isset($this->settings['softkey3_value'])) {
            $this->settings['softkey3_value'] = "*8";
        }
        if (!isset($this->settings['softkey4_label'])) {
            $this->settings['softkey4_label'] = "DND";
        }
        if (!isset($this->settings['softkey4_type'])) {
            $this->settings['softkey4_type'] = "21";
        }
    }
}
