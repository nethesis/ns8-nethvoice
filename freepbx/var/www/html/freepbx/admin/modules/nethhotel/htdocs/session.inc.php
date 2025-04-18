<?php
session_start();
if (!isset($_SESSION['AMP_user']) || !$_SESSION['AMP_user']->checkSection('hotel')) {
    header("Location: /freepbx/admin/config.php?display=hotel");
    exit(1);
}
