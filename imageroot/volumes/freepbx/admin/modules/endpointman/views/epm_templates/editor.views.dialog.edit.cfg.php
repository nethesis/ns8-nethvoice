<div class="modal fade" id="CfgEditFileTemplate" tabindex="-1" role="dialog" aria-labelledby="myModalLabelB" aria-hidden="true">
	<div class="modal-dialog modal-lg" role="document">
		<div class="modal-content">
			<div class="modal-header">
				<h4 class="modal-title"><?php echo _('End Point Configuration Manager')?></h4>
			</div>
			<div class="modal-body">

				<form action="" id="FormCfgEditFileTemplate" name="FormCfgEditFileTemplate">
            		<input type="hidden" name="type_file" value="" />
					<input type="hidden" name="name_file" value="" />
					<input type="hidden" name="edit_file" value="false" />
                
          			<label class="control-label" for="config_textarea"><i class="fa fa-file-code-o" data-for="config_textarea"></i> Cantenido del archivo:</label> <code class='inline' id='edit_file_name_path'><?php echo _("No Selected"); ?></code>
          			<textarea name="config_textarea" id="config_textarea" rows="5"></textarea>
				</form>
			</div>
			<div class="modal-footer">
                <button type="button" class="btn btn-success" name="bt_edit_file_save"  ><i class="fa fa-floppy-o" aria-hidden="true"></i> <?php echo _('Save')?></button>
				<button type="button" class="btn btn-danger"  name="bt_edit_file_cancel" data-dismiss="modal"><i class="fa fa-trash" aria-hidden="true"></i> <?php echo _('Cancel')?></button>
			</div>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->