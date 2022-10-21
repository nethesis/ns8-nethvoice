<div class="container-fluid">
	<div class="row">
		<div class="col-sm-12">
			<div class="fpbx-container">
				<div class="display no-border">
					<div id="toolbar-all">
						<a class="btn btn-primary" href="?display=soundlang&amp;action=settings"><i class="fa fa-cog"></i> <?php echo _("Settings")?></a>
						<a class="btn btn-primary" href="?display=soundlang&amp;action=customlangs"><i class="fa fa-globe"></i> <?php echo _("Custom Languages")?></a>
					</div>
					<table data-toolbar="#toolbar-all" data-toggle="table" data-pagination="true" data-show-columns="true" data-show-toggle="true" data-search="true" data-cookie="true" data-cookie-id-table="soundlangscookie"  class="table table-striped">
						<thead>
							<tr>
								<th data-sortable="true"><?php echo _("Language")?></th>
								<th data-sortable="true"><?php echo _("Author")?></th>
								<th><?php echo _("Actions")?></th>
							</tr>
						</thead>
						<tbody>
							<?php foreach ($languages as $language => $package) { ?>
							<tr>
								<td>
								<?php
									$name = $language;
									$lang = explode('_', $language, 2);
									if (count($lang) > 1 && !empty($languagelocations[$lang[1]]) && !empty($languagenames[$lang[0]])) {
										$name = $languagenames[$lang[0]] . ' - ' . $languagelocations[$lang[1]] . ' (' . $language . ')';
									} else if (!empty($languagenames[$lang[0]])) {
										$name = $languagenames[$lang[0]] . ' (' . $language . ')';
									}

								?>
									<a href="config.php?display=soundlang&amp;action=language&amp;lang=<?php echo $language; ?>"><?php echo $name; ?></a>
								</td>
								<td>
								<?php
									if (!empty($package['authorlink'])) {
								?>
										<a href="<?php echo $package['authorlink']; ?>" target="#"><?php echo $package['author']; ?></a>
								<?php
									} else {
										echo $package['author'];
									}
								?>
								</td>
								<td>
								<?php if ($package['installed']) { ?>
									<a href="#" data-langid="<?php echo $language; ?>" id="licenselink<?php echo $language; ?>"><i class="fa fa-ban fa-fw"></i></a>
								<?php } else { ?>
									<a href="#" data-toggle="modal" data-langid="<?php echo $language ;?>" data-target="#licensemodal" id="licenselink<?php echo $language; ?>" data-licenselink="<?php echo $package['license']; ?>" class="clickable"><i class="fa fa-download fa-fw"></i></a>
								<?php } ?>
								</td>
							</tr>
							<?php } ?>
						</tbody>
					</table>
					<?php echo load_view(dirname(__FILE__).'/licensemodal.php')?>
				</div>
			</div>
		</div>
	</div>
</div>
