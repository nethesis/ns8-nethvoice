<?php

#########################################
# PHPLiveX Library						#
# (C) Copyright 2006 Arda Beyazo�lu		#
# Version: 2.3							#
# Home Page: phplivex.sourceforge.net	#
# Contact: ardabeyazoglu@gmail.com      #
#########################################

class PHPLiveX {

var $FileUrl;
var $Url;
var $Error = "";

var $FList = array();

function PHPLiveX($funcList = "", $url = ""){
	$this->Export($funcList);

	if(!empty($_SERVER["QUERY_STRING"])) $query = "?" . $_SERVER["QUERY_STRING"];
	else $query = "";

	if($url == ""){
		$this->Url = $_SERVER["PHP_SELF"].$query;
	}else{
		 $this->FileUrl = $url;
		 $this->Url = $url . $query;
	}

}

function Export($funcList = ""){
	if($funcList == "") return;
	if($funcList == "ALL"){
		$functions = get_defined_functions();
		$funcList = implode(",", $functions["user"]);
	}
	$funcArray = explode(",", $funcList);
	for($i=0;$i<count($funcArray);$i++){
		$funcArray[$i] = stripslashes(trim($funcArray[$i]));
		if(function_exists($funcArray[$i])){
			if(!in_array($funcArray[$i], $this->FList)){
				$this->FList[] = $funcArray[$i];
			}
		}else{
			$this->Error .= "'" . $funcArray[$i] . "' function doesn't exist!";
			?>
			<script language="javascript">
			alert("<?php echo $this->Error ?>");
			</script>
			<?php
		}
	}
	$this->Execute();
	reset($this->FList);
}

function ExportClassFunctions($funcList = ""){
	if($funcList == "") return;
	$funcArray = explode(",", $funcList);
	for($i=0;$i<count($funcArray);$i++){
		$funcArray[$i] = stripslashes(trim($funcArray[$i]));
		if(strpos($funcArray[$i], "->") === false) continue;

		$parts = explode("->", $funcArray[$i]);
		$instanceName = $parts[0];
		$funcName = $parts[1];
		$newName = $instanceName . "__" . $funcName;
		global $$instanceName;

		if(!in_array($newName, $this->FList)){
			$_SESSION["plx_" . $instanceName] = $$instanceName;
	 		$this->FList[] = $newName;
		}
	}
	reset($this->FList);
	$this->Execute();
}

function ExportClass($instanceList = ""){
	if($instanceList == "") return;
	$instanceArray = explode(",", $instanceList);
	for($i=0;$i<count($instanceArray);$i++){
		$instanceArray[$i] = stripslashes(trim($instanceArray[$i]));

		$instanceName = $instanceArray[$i];
		global $$instanceName;
		$methods = get_class_methods($$instanceName);

		for($k=1;$k<count($methods);$k++){
			$newName = $instanceName . "__" . $methods[$k];
			if(!in_array($newName, $this->FList)){
				$_SESSION["plx_" . $instanceName] = $$instanceName;
				$this->FList[] = $newName;
			}
		}
	}
	reset($this->FList);
	$this->Execute();
}

function Execute(){
	$funcName = ""; $funcArgs = array();
	if(isset($_REQUEST["funcName"])){
		$funcName = $_REQUEST["funcName"];
		if(isset($_REQUEST["funcArgs"])) $funcArgs = $_REQUEST["funcArgs"];

		if(isset($_GET["funcName"])){
			header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
			header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
			header("Cache-Control: no-cache, must-revalidate");
			header("Pragma: no-cache");
		}

		if(strpos($funcName, "__") === false){
			if(in_array($funcName, $this->FList)){
				$runFunc = call_user_func_array($funcName, $funcArgs);
				echo "<phplivex>" . $runFunc . "</phplivex>";
				exit();
			}
		}else{
			if(in_array($funcName, $this->FList)){
				$parts = explode("__", $funcName);
				$object = $_SESSION["plx_" . $parts[0]];
				echo "<phplivex>" . call_user_func_array(array($object, $parts[1]), $funcArgs) . "</phplivex>";
				exit();
			}
		}
	}
}

function CreateJS(){
	ob_start();

	?>

	/////////////////////////////////////////
	// PHPLiveX Library                    //
	// (C) Copyright 2006 Arda Beyazo�lu   //
	// Version: 2.3                        //
	// Home Page: phplivex.sourceforge.net //
	/////////////////////////////////////////

	function PHPLiveX(type, target, mode, preload, method, onFinish, onUpdate, interval, hideContent, myPreload){
		this.TYPE = type;
		this.MODE = mode;
		this.TARGET = target;
		this.PRELOAD = preload;
		this.METHOD = method;
		this.ONFINISH = onFinish;
		this.ONUPDATE = onUpdate;
		this.INTERVAL = interval;
		this.HIDECONTENT = hideContent;
		this.MYPRELOAD = myPreload;
		if(String(myPreload).indexOf(":") != -1){
			var preloadFunctions = myPreload.split(":");
			this.MYPRELOAD = new Array(2);
			this.MYPRELOAD[0] = preloadFunctions[0];
			this.MYPRELOAD[1] = preloadFunctions[1];
		}
	}

	PHPLiveX.prototype.GetSpecialChars = function(str){
		str = str.replace(/%E7/g,String.fromCharCode(231)); //"�");
		str = str.replace(/%C7/g,String.fromCharCode(199)); //"�");
		str = str.replace(/%u011F/g,String.fromCharCode(240)); //"�");
		str = str.replace(/%u011E/g,String.fromCharCode(208)); //"�");
		str = str.replace(/%u0131/g,String.fromCharCode(253)); //"�");
		str = str.replace(/%u0130/g,String.fromCharCode(221)); //"�");
		str = str.replace(/%F6/g,String.fromCharCode(246)); //"�");
		str = str.replace(/%D6/g,String.fromCharCode(214)); //"�");
		str = str.replace(/%u015F/g,String.fromCharCode(254)); //"�");
		str = str.replace(/%u015E/g,String.fromCharCode(222)); //"�");
		str = str.replace(/%FC/g,String.fromCharCode(252)); //"�");
		str = str.replace(/%DC/g,String.fromCharCode(220)); //"�");
		return unescape(str);
	}

	PHPLiveX.prototype.EscapeSpecialChars = function(str){
		str = str.replace(/%E7/g,escape(String.fromCharCode(231))); //"�"));
		str = str.replace(/%C7/g,escape(String.fromCharCode(199))); //"�"));
		str = str.replace(/%u011F/g,escape(String.fromCharCode(240))); //"�"));
		str = str.replace(/%u011E/g,escape(String.fromCharCode(208))); //"�"));
		str = str.replace(/%u0131/g,escape(String.fromCharCode(253))); //"�"));
		str = str.replace(/%u0130/g,escape(String.fromCharCode(221))); //"�"));
		str = str.replace(/%F6/g,escape(String.fromCharCode(246))); //"�"));
		str = str.replace(/%D6/g,escape(String.fromCharCode(214))); //"�"));
		str = str.replace(/%u015F/g,escape(String.fromCharCode(254))); //"�"));
		str = str.replace(/%u015E/g,escape(String.fromCharCode(222))); //"�"));
		str = str.replace(/%FC/g,escape(String.fromCharCode(252))); //"�"));
		str = str.replace(/%DC/g,escape(String.fromCharCode(220))); //"�"));
		return str;
	}

	PHPLiveX.prototype.ShowError = function(errorMsg){
		if(errorMsg != ""){
			alert(errorMsg);
			return false;
		}else{
			return true;
		}
	}

	PHPLiveX.prototype.GetXmlHttp = function(){
		objXmlHttp = false;
        if (window.XMLHttpRequest) {
            objXmlHttp = new XMLHttpRequest();
            if (objXmlHttp.overrideMimeType) {
                objXmlHttp.overrideMimeType('text/xml');
            }
        } else if (window.ActiveXObject) {
            try {
                objXmlHttp = new ActiveXObject("Msxml2.XMLHTTP");
            } catch (e) {
                try {
                    objXmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
                } catch (e) {}
            }
        }

        if (!objXmlHttp) {
            alert('Giving up :( Cannot create an XMLHTTP instance');
            return false;
        }

		return objXmlHttp;
	}

	PHPLiveX.prototype.CreatePreloading = function(){
		if(this.MYPRELOAD != null){
			eval(this.MYPRELOAD[0] + "()");
		}else if(this.PRELOAD != null){
			document.getElementById(this.PRELOAD).style.display = "";
			document.getElementById(this.PRELOAD).style.visibility = "visible";
		}
		if(this.HIDECONTENT == 1) document.getElementById(this.TARGET).innerHTML = "";
	}

	PHPLiveX.prototype.CompletePreloading = function(){
		if(this.MYPRELOAD != null){
			eval(this.MYPRELOAD[1] + "()");
		}else if(this.PRELOAD != null){
			document.getElementById(this.PRELOAD).style.display = "none";
			document.getElementById(this.PRELOAD).style.visibility = "hidden";
		}
	}

	PHPLiveX.prototype.CreateOutput = function(funcName, funcArgs, funcUrl){
		var data = "funcName=" + escape(funcName);
		var args = new Array();
		if(funcUrl == null){ funcUrl = "<?php echo $this->Url ?>"; }
		if(funcArgs != ""){
			if(funcArgs.indexOf(",") != -1){
				args = funcArgs.split(",");
				for (i=0;i<args.length;i++) data += "&funcArgs[]=" + this.EscapeSpecialChars(escape(args[i]));
			}else{
				data += "&funcArgs[]=" + this.EscapeSpecialChars(escape(funcArgs));
			}
		}
		var parentObject = this;

		var XmlHttp = this.GetXmlHttp();
		var ajaxType = false;
		if(this.TYPE != "r") ajaxType = true;

		//this.CreatePreloading();

		if(this.METHOD == "get"){
			if(funcUrl.indexOf("?") != -1){
				XmlHttp.open("GET", funcUrl + "&" + this.EscapeSpecialChars(data), ajaxType);
			}else{
				XmlHttp.open("GET", funcUrl + "?" + this.EscapeSpecialChars(data), ajaxType);
			}
		}else{ XmlHttp.open("post", funcUrl, ajaxType); }

		if(this.METHOD == "post"){
			XmlHttp.setRequestHeader("Method", "POST " + funcUrl + " HTTP/1.1");
			XmlHttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		}

		if(this.TYPE != "r"){
			this.CreatePreloading();

			XmlHttp.onreadystatechange = function(){
				if(XmlHttp.readyState == 0){
					XmlHttp.abort();
				}else if(XmlHttp.readyState == 4){
					parentObject.CompletePreloading();

					var output = parentObject.GetSpecialChars(XmlHttp.responseText);
					var outparts = output.split("<phplivex>");
					output = outparts[outparts.length-1].split("</phplivex>")[0];
					output = output.replace(/<plus>/g, "+");
					output = output.replace(/<comma>/g, ",");

					var jscode = "";
					var parts = output.match(/<script[^>]*>(.|\n|\t|\r)*?<\/script>/gi);
					if(parts){
						for(i=0;i<parts.length;i++){
							jscode += parts[i].replace(/<script[^>]*>|<\/script>/gi, "");
							output = output.replace(parts[i], "");
						}
					}

					if(parentObject.ONFINISH != null) output = eval(parentObject.ONFINISH + "(output)");

					if(parentObject.PRELOAD != null){ document.getElementById(parentObject.PRELOAD).style.visibility = "hidden"; }

					if(parentObject.TYPE == "e"){ return; }
					else if(parentObject.TARGET == "alert"){ alert(output); }
					else{
						var targets = Array();
						if(parentObject.TARGET.indexOf(":") != -1) targets = parentObject.TARGET.split(":");
						else targets[0] = parentObject.TARGET;
						for(i=0; i<targets.length; i++){
							var item = document.getElementById(targets[i]);
							if(item == "[object HTMLInputElement]" || item.type != undefined){
								if(parentObject.MODE == "aw"){ item.value += output; }
								else if(parentObject.MODE == "rw"){ item.value = output; }
								else if(parentObject.MODE == "asw"){
									var initialValue = item.value;
									item.value = output + initialValue;
								}
							}else{
								if(parentObject.MODE == "aw"){ item.innerHTML += output; }
								else if(parentObject.MODE == "rw"){ item.innerHTML = output; }
								else if(parentObject.MODE == "asw"){
									var initialHTML = item.innerHTML;
									item.innerHTML = output + initialHTML;
								}
							}
						}
					}
					if(parentObject.ONUPDATE != null) eval(parentObject.ONUPDATE + "(output)");

					if(jscode != ""){
						var script = document.createElement("script");
						script.type = "text/javascript";
						script.lang = "javascript";
						script.text = jscode;
						document.getElementsByTagName("head")[0].appendChild(script);
					}
				}
			}

			if(this.METHOD == "get"){ XmlHttp.send(null); }
			else{ XmlHttp.send(this.EscapeSpecialChars(data)); }
		}else{
			if(this.METHOD == "get"){ XmlHttp.send(null); }
			else{ XmlHttp.send(this.EscapeSpecialChars(data)); }
			var output = this.GetSpecialChars(XmlHttp.responseText);
			var outparts = output.split("<phplivex>");
			output = outparts[outparts.length-1].split("</phplivex>")[0];
			output = output.replace(/<plus>/g, "+");
			output = output.replace(/<comma>/g, ",");

			//If JS Code Exists
			var jscode = "";
			var parts = output.match(/<script[^>]*>(.|\n|\t|\r)*?<\/script>/gi);
			if(parts){
				for(i=0;i<parts.length;i++){
					jscode += parts[i].replace(/<script[^>]*>|<\/script>/gi, "");
					output = output.replace(parts[i], "");
				}
			}
			if(jscode != ""){
				var script = document.createElement("script");
				script.type = "text/javascript";
				script.lang = "javascript";
				script.text = jscode;
				document.getElementsByTagName("head")[0].appendChild(script);
			}
			//

			return output;
		}
	}

	PHPLiveX.prototype.Callback = function(funcName, funcArgs){
		var args = new Array(); var plx_args = new Array();
		var plxType = "e"; var plxTarget = null;
		var plxMode = "rw"; var plxPreload = null;
		var plxMethod = "post"; var plxOnFinish = null;
		var plxOnUpdate = null; var plxInterval = 0;
		var plxHideContent = 0; var plxMyPreload = null;

		for(i=0;i<funcArgs.length;i++){
			args[i] = "" + funcArgs[i];
			if(i == funcArgs.length-1) continue;
			if(args[i].indexOf("+")) args[i] = args[i].replace(/\+/g, "<plus>");
			if(args[i].indexOf(",")) args[i] = args[i].replace(/,/g, "<comma>");
		}

		if(args[args.length-1].indexOf(",") != -1){ plx_args = args[args.length-1].split(","); }
		else{ plx_args[0] = args[args.length-1]; }

		for(i=0;i<plx_args.length;i++){
			if(plx_args[i].indexOf("type=") != -1){
				plxType = plx_args[i].substr(5);
			}else if(plx_args[i].indexOf("target=") != -1){
				plxTarget = plx_args[i].substr(7);
				plxType = "print";
			}else if(plx_args[i].indexOf("mode=") != -1){
				plxMode = plx_args[i].substr(5);
			}else if(plx_args[i].indexOf("preload=") != -1){
				plxPreload = plx_args[i].substr(8);
			}else if(plx_args[i].indexOf("method=") != -1){
				plxMethod = plx_args[i].substr(7);
			}else if(plx_args[i].indexOf("onFinish=") != -1){
				plxOnFinish = plx_args[i].substr(9);
			}else if(plx_args[i].indexOf("onUpdate=") != -1){
				plxOnUpdate = plx_args[i].substr(9);
			}else if(plx_args[i].indexOf("interval=") != -1){
				plxInterval = parseInt(plx_args[i].substr(9));
			}else if(plx_args[i].indexOf("hideContent=") != -1){
				plxHideContent = plx_args[i].substr(12);
			}else if(plx_args[i].indexOf("myPreload=") != -1){
				plxMyPreload = plx_args[i].substr(10);
			}
		}

		args.splice(args.length-1, 1);
		var StringArgs = args.join();

		var PLX = new PHPLiveX(plxType, plxTarget, plxMode, plxPreload, plxMethod, plxOnFinish, plxOnUpdate, plxInterval, plxHideContent, plxMyPreload);

		try{
			if(plxType == "r"){
				return PLX.CreateOutput(funcName, StringArgs<?php echo !empty($this->FileUrl) ? ",\"".$this->Url."\"" : "" ; ?>);
			}else{
				PLX.CreateOutput(funcName, StringArgs<?php echo !empty($this->FileUrl) ? ",\"".$this->Url."\"" : "" ;?>);
			}
		}catch(ex){
			PLX.ShowError(ex);
		}

		if(plxInterval != 0){
			var strArgs = funcArgs[funcArgs.length-1];
			var st = setTimeout("eval(" + funcName + "('" + StringArgs + "', '" + strArgs + "'))", plxInterval);
		}
	}

	<?php
	$html = ob_get_contents();
	ob_end_clean();
	return $html;

}



function CreateFunction($funcName){
	ob_start();
	?>
	function <?php echo $funcName ?>(){
		var plx = new PHPLiveX();
		return plx.Callback("<?php echo $funcName ?>", <?php echo $funcName ?>.arguments);
	}

	<?php
	$html = ob_get_contents();
	ob_end_clean();
	return $html;

}

function Run(){
	$html = $this->CreateJS();
	for($i=0;$i<count($this->FList);$i++){
		$html .= $this->CreateFunction($this->FList[$i]);
	}
	echo "<script language=\"javascript\">".$html."</script>";
}

function GetFunctions(){
	$html = "";
	for($i=0;$i<count($this->FList);$i++){
		$html .= $this->CreateFunction($this->FList[$i]);
	}
	return $html;
}


}


?>
