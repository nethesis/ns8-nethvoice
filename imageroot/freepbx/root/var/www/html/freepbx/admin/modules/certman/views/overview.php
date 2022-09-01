<?php
if(!empty($message)) {
	$messagehtml = '<div class="alert alert-' . $message['type'] .'">'. $message['message'] . '</div>';
}
?>
<div class="container-fluid">
	<h1><?php echo _('Certificate Management')?></h1>

	<div class="panel panel-info">
		<div class="panel-heading">
			<div class="panel-title">
				<a href="#" data-toggle="collapse" data-target="#moreinfo"><i class="glyphicon glyphicon-info-sign"></i></a>&nbsp;&nbsp;&nbsp;<?php echo _("What is Certificate Manager?")?></div>
		</div>
		<!--At some point we can probably kill this... Maybe make is a 1 time panel that may be dismissed-->
		<div class="panel-body collapse" id="moreinfo">
			<p><?php echo _("Certificate Manager manages certificates for secure calling (TLS/SRTP), secure web sessions (HTTPS/WEBRTC[WSS] and more")?></p>
			<p><?php echo _("From this interface you can generate a Certificate Signing Request (CSR) which you can then use to issue a certificate to use for this server")?></p>
			<p><?php echo sprintf(_("Additionally if you have opened internet access up to the outside world you can signup for a FREE certificate from the Let's Encrypt project. Learn more %s"),'<a href="https://letsencrypt.org/">'._("Here").'</a>')?></p>
			<p><?php echo _("A Self-Signed Certificate has been generated for you on install. You can use this certificate now to get started however we strongly urge you to get a real certificate from a standard authority or through Let's Encrypt")?></p>
			<p><?php echo sprintf(_("To manually import certificate files place them into %s and make sure they have the same basename, EG: %s"),$location,"mycert.key, mycert.crt")?></p>
			<p><?php echo _("There are three different types of certificates this module can handle:")?></p>
			<ul>
				<li><?php echo _("Let's Encrypt:")?> <?php echo _("Information")?></li>
				<li><?php echo _("Uploaded:")?> <?php echo _("Information")?></li>
				<li><?php echo _("Self-Signed:")?> <?php echo _("Information")?></li>
			</ul>
		</div>
	</div>
	<?php echo !empty($messagehtml) ? $messagehtml : "" ?>
	<div class = "display no-border">
		<?php echo load_view(__DIR__.'/certgrid.php',array('certs' => $certs, 'csr' => $csr, 'ca' => $ca)); ?>
		<i><?php echo _("Hover over the 'Default' column and click to make a certificate the system default")?></i>
		<p><strong><?php echo _("Note:")?></strong> <?php echo sprintf(_("Making a certificate the 'default' changes certificate settings in Advanced Settings ONLY. It will force said certificate to be the default for options in Advanced Settings that require certificates. It will also place a standard set of the certificate and it's key into %s for use by other applications"),$location."/integration")?></p>
	</div>
</div>
