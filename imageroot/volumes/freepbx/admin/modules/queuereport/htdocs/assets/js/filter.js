function GridHeader(type, header){
	if(type == "over"){
                header.className = "gridHover";
		header.style.cursor = "pointer";
	}else{
                header.className = "gridOut";
	}
}

//Applica il filtro solo se la checkbox è spuntata
function ExecAllFilter(functions,targets)
{
  if(document.searchForm.activeFilter.checked)
  {
    ApplyFilter(functions,targets);
  }
}

//Applica il filtro a tutte le funzioni specificate e riporta i dati ottenuti nei target
function ApplyFilter(functions,targets)
{

    for(var i=0;i<functions.length;i++)
    {
      var params = "target="+targets[i]+",preload=listing,hideContent=1";
      execFilter(functions[i]+'|'+document.searchForm.activeFilter.checked+'|'+document.searchForm.fromdate.value+'|'+document.searchForm.todate.value+'|'+document.searchForm.chiamante.value+'|'+document.searchForm.agente.value+'|'+document.searchForm.coda.value+'|'+document.searchForm.gruppo.value, params);
    }
}
