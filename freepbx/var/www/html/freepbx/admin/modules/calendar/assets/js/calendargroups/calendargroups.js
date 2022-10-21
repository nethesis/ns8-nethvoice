$(document).ready(function() {
	$('#events').multiselect({
			enableFiltering: true,
			enableFullValueFiltering: true,
			enableClickableOptGroups: true,
			enableCollapsibleOptGroups: true,
			includeSelectAllOption: true,
			enableCaseInsensitiveFiltering: true,
			buttonWidth: '50%',
			nonSelectedText: _('Use All Events'),
			buttonContainer: '<div class="btn-group ok"><span class="radioset" id="expand"><input type="checkbox" id="expandcheck" name="expand" class="form-control"><label for="expandcheck">'+_('Expand Recurring Dates')+'</label></span><div>'
	});
	$('#calendars').multiselect({
			enableFiltering: true,
			enableFullValueFiltering: true,
			enableCaseInsensitiveFiltering: true,
			buttonWidth: '50%'
	});
	$('#categories').multiselect({
			enableFiltering: true,
			enableFullValueFiltering: true,
			enableClickableOptGroups: true,
			enableCollapsibleOptGroups: true,
			includeSelectAllOption: true,
			enableCaseInsensitiveFiltering: true,
			buttonWidth: '50%',
			nonSelectedText: _('Use All Categories')
	});
	$(document).on('click','#expandcheck',function() {
		$.post( "ajax.php?module=calendar&command=groupeventshtml", {calendars: $("#calendars").val(), categories: $("#categories").val(), expand: $("#expandcheck").is(":checked")}, function( data ) {
			$("#events").html(data.eventshtml);
			$('#events').multiselect('rebuild');
		});
	});
	$('#calendars').change(function() {
		$.post( "ajax.php?module=calendar&command=groupeventshtml", {calendars: $(this).val(), categories: $("#categories").val(), expand: $("#expandcheck").is(":checked")}, function( data ) {
			var cats = $("#categories").val();
			$("#categories").html(data.categorieshtml);
			$('#categories').multiselect('rebuild');
			$('#categories').multiselect('select', cats);
			$("#events").html(data.eventshtml);
			$('#events').multiselect('rebuild');
		});
	});
	$('#categories').change(function() {
		$.post( "ajax.php?module=calendar&command=groupeventshtml", {calendars: $("#calendars").val(), categories: $(this).val(), expand: $("#expandcheck").is(":checked")}, function( data ) {
			$("#events").html(data.eventshtml);
			$('#events').multiselect('rebuild');
		});
	});

	if($('#calendars').length && $('#calendars').val() !== null) {
		$("#expandcheck").prop("checked",expand);
		$.post( "ajax.php?module=calendar&command=groupeventshtml", {calendars: $("#calendars").val(), categories: categories, expand: expand}, function( data ) {
			$("#categories").html(data.categorieshtml);
			$('#categories').multiselect('rebuild');
			$('#categories').multiselect('select', categories);
			$("#events").html(data.eventshtml);
			$('#events').multiselect('rebuild');
			$('#events').multiselect('select', events);
		});
	}
});
