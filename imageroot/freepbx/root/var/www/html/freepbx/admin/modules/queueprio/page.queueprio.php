<?php
if (!defined('FREEPBX_IS_AUTH')) { die('No direct script access allowed'); }
$view = isset($_REQUEST['view'])?$_REQUEST['view']:'';
$helptext = _("Queue Priority allows you to set a caller's priority in a queue. By default, a caller's priority is set to 0. Setting a higher priority will put the caller ahead of other callers already in a queue. The priority will apply to any queue that this caller is eventually directed to. You would typically set the destination to a queue, however that is not necessary. You might set the destination of a priority customer DID to an IVR that is used by other DIDs, for example, and any subsequent queue that is entered would be entered with this priority");
switch ($view) {
	case 'form':
		$content = load_view(__DIR__.'/views/form.php');
		$bootnav = load_view(__DIR__.'/views/bootnav.php', array('view'=>$view));
	break;

	default:
		$content = load_view(__DIR__.'/views/grid.php');
		$bootnav = '';
	break;
}
?>
<div class="container-fluid">
	<h1><?php echo _('Queue Priorties')?></h1>
	<div class="well well-info">
		<?php echo $helptext?>
	</div>
	<div class = "display full-border">
		<div class="row">
			<div class="col-sm-9">
				<div class="fpbx-container">
					<div class="display full-border">
						<?php echo $content?>
					</div>
				</div>
			</div>
			<?php echo $bootnav ?>
		</div>
	</div>
</div>
