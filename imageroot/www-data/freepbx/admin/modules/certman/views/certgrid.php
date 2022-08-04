<!-- Certificates table-->
<div id="toolbar-all">
	<div class="dropdown" style="display:inline-block;">
		<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-expanded="false">
			<i class="fa fa-plus">&nbsp;</i><?php echo _('New Certificate')?> <span class="caret"></span>
		</button>
		<ul class="dropdown-menu" role="menu">
			<li><a href="?display=certman&amp;action=add&amp;type=le"><i class="fa fa-plus"></i> <strong><?php echo _("Generate Let's Encrypt Certificate")?></strong></a></li>
			<li><a href="?display=certman&amp;action=add&amp;type=up"><i class="fa fa-plus"></i> <strong><?php echo _("Upload Certificate")?></strong></a></li>
			<li><a href="?display=certman&amp;action=add&amp;type=ss"><i class="fa fa-plus"></i> <strong><?php echo _("Generate Self-Signed Certificate")?></strong></a></li>
		</ul>
	</div>
	<?php if(!$csr) { ?>
		<a href="?display=certman&amp;action=add&amp;type=csr" class="btn btn-primary"><i class="fa fa-plus"></i> <?php echo _("Generate CSR")?></a>
	<?php } else { ?>
		<a href="?display=certman&amp;quietmode=1&amp;action=download&amp;type=csr" class="btn btn-primary"><i class="fa fa-download"></i> <?php echo _("Download CSR")?></a>
		<a href="?display=certman&amp;certaction=delete&amp;type=csr" class="btn btn-danger" id="delCSR"><i class="fa fa-times"></i> <?php echo _("Delete CSR")?></a>
	<?php } ?>
	<?php if($ca) { ?>
		<a href="?display=certman&amp;certaction=delete&amp;type=ca" class="btn btn-danger" id="delCA"><i class="fa fa-times"></i> <?php echo _("Delete Self-Signed CA")?></a>
	<?php } ?>
	<a href="?display=certman&amp;certaction=importlocally" class="btn btn-primary"><?php echo _("Import Locally")?></a>
</div>
<table data-toolbar="#toolbar-all" data-maintain-selected="true" data-show-columns="true" data-show-toggle="true" data-toggle="table" data-pagination="true" data-search="true" class="table table-striped">
	<thead>
		<tr>
			<th><?php echo _("Certificate") ?></th>
			<th><?php echo _("Description") ?></th>
			<th><?php echo _("Type") ?></th>
			<th><?php echo _("Default") ?></th>
			<th><?php echo _("Action") ?></th>
		</tr>
	</thead>
	<tbody>
		<?php foreach($certs as $cert) {?>
			<tr>
				<td><?php echo $cert['basename']?></td>
				<td><?php echo $cert['description']?></td>
				<td>
					<?php switch($cert['type']) {
						case "ss":
							echo _("Self Signed");
						break;
						case "up":
							echo _("Uploaded");
						break;
						case "le":
							echo "Let's Encrypt";
						break;
					}?>
				</td>
				<td><div class="default-check <?php echo !empty($cert['default']) ? "check" : ""?>" data-id="<?php echo $cert['cid']?>"><i class="fa fa-check" aria-hidden="true"></i></div></td>
				<td><a href='?display=certman&amp;action=view&amp;id=<?php echo $cert['cid']?>'>
					<i class="fa fa-edit"></i></a>&nbsp;&nbsp;
					<a class="deletecert" href='config.php?display=certman&amp;certaction=delete&amp;type=cert&amp;id=<?php echo $cert['cid']?>'>
					<i class="fa fa-trash"></i></a>
				</td>
			</tr>
		<?php } ?>
	</tbody>
</table>
<!--End Certificates table-->
