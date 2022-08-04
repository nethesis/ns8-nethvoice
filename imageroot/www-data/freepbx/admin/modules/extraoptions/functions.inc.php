<?php
#
# Copyright (C) 2018 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

function extraoptions_get_config($engine) {
    global $ext;
    global $amp_conf;
    global $db;
    global $core_conf;
    switch($engine) {
        case "asterisk":
            /*Allow to configure some features: https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+Configuration_features */
            $featuresdetails = featurecodes_getAllFeaturesDetailed();
            $options = array();
            foreach ($featuresdetails as $f) {
                if ($f['modulename'] == 'extraoptions') {
                    $options[] = $f['featurename'];
                }
            }

            foreach($options as $option) {
                $fcc = new featurecode('extraoptions', $option);
                $code = $fcc->getCodeActive();
                unset($fcc);
                if ($code != '') {
                    $core_conf->addFeatureGeneral($option,$code);
                }
            }

        break;
    }
}

