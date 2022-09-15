<?php

//Deve essere chiamato fra  ob_start e ob_end_clean
//Se page == -1, il pager non deve stampare nulla (usato per l'esportazione dei dati in xls e pdf)
function createPager($results, $totalPages, $rowsPerPage, $page, $target, $size, $func_name)
{
    if ($page == -1) {
        return;
    }

    $ext = 'href="javascript:' . "$func_name('1', '" . $_SESSION['order'] . "','target=$target,preload=listing')" . '"';
    if ($results > $rowsPerPage) {
        echo '<tfoot><tr><th colspan="' . $size . '">
                <div class="ui right floated pagination menu">
                <a '.$ext.' class="icon item">
                <span class="popup" data-tooltip="'. _('First page') .'" data-inverted="">
                    <i class="angle double left icon"></i>
                </span>
                </a>';
    }

    if ($results <= $rowsPerPage) {
        $limit = 0;
    } elseif (($results % $rowsPerPage) == 0) {
        $limit = ($results / $rowsPerPage) + 1;
    } else {
        $limit = ($results / $rowsPerPage) + 1;
    }
    if ($limit > 10 && $_SESSION['page'] > 5) {
        if ($_SESSION['page'] + 4 <= $limit) {
            $start = $_SESSION['page'] - 5;
            $end = $_SESSION['page'] + 4;
        } else {
            $start = $limit - 9;
            $end = $limit;
        }
    } elseif ($limit > 10) {
        $start = 1;
        $end = 10;
    } else {
        $start = 1;
        $end = $limit;
    }
    if ($start > 1) {
        echo '<a class="item">...</a>';
    }
    $start = ceil($start);
    $end = ceil($end);

    for ($i = $start; $i < $end; ++$i) {
        if ($i != $_SESSION['page']) {
            $ext = 'href="javascript:' . "$func_name('" . $i . "', '" . $_SESSION['order'] . "','target=$target,preload=listing')" . '" style="text-decoration:none;"';
        } else {
            $ext = '';
        }
        echo '<a '.$ext.'class="item">'.$i.'</a>';
    }
    if($end > 1) {
        echo '              <a '.$ext.' class="icon item">
                                <span class="popup" data-tooltip="'. _('Last page'). '" data-inverted="">
                                    <i class="angle double right icon"></i>
                                </span>
                            </a>';
    }
    if ($end < ceil($limit)) {
        echo '<a class="item">...</a>';
    }

    echo '</div></th></tr></tfoot>';
}

//#### inizializzazione variabili per la paginazione e l'ordinamento
function setOrderAndPage($page, $order)
{
    if ($order != null) {
        $_SESSION['order'] = $order;
    } else {
        $_SESSION['order'] = DEFAULT_ORDER;
    }

    if ($page != '' && $page != -1) {
        $_SESSION['page'] = $page;
    }

    if (!$_SESSION['page']) {
        $_SESSION['page'] = 1;
    }

    return abs(($_SESSION['page'] - 1) * ROWS_PER_PAGE);
}

function getGeneraleNull($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='ABANDON' and hold<" . SEC_IGNORE;
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname, count(id) as num, qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
<table class='ui cdr selectable celled striped table'>
    <thead>
        <tr class="center aligned">
            <th class="cdrhdr" colspan="3" id="gridHead"><?php echo _('Report null calls -');?><!--Report chiamate nulle--> <?php filter_summary();?></th>
        </tr>
        <tr>
            <th class="cdrhdr" onclick="getGeneraleNull('', 'period  <?php echo $neworder;?>', 'target=null,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
            <th class="cdrhdr" onclick="getGeneraleNull('', 'qname  <?php echo $neworder;?>', 'target=null,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
            <th class="cdrhdr" onclick="getGeneraleNull('', 'num  <?php echo $neworder;?>', 'target=null,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
        </tr>
    </thead>
    <tbody>
    <?php
   $class = true;
        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[3] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '</tr>';
            $class = !$class;
        }

       //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'null', 3, 'getGeneraleNull');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeneraleFull($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='FULL' ";
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname, count(id) as num, qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
<table class='ui cdr selectable celled striped table'>
    <thead>
        <tr class="center aligned">
            <th class="cdrhdr" colspan="3" id="gridHead"><?php echo _('Report outputs full queue -');?><!--Report uscite coda piena--> <?php filter_summary();?></th>
        </tr>
        <tr>
            <th class="cdrhdr" onclick="getGeneraleFull('', 'period  <?php echo $neworder;?>', 'target=full,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
            <th class="cdrhdr" onclick="getGeneraleFull('', 'qname  <?php echo $neworder;?>', 'target=full,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
            <th class="cdrhdr" onclick="getGeneraleFull('', 'num  <?php echo $neworder;?>', 'target=full,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
        </tr>
    </thead>
    <tbody>
    <?php
    $class = true;
        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[3] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'full', 3, 'getGeneraleFull');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}
function getGeneraleJoinempty($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action in ('JOINEMPTY','JOINUNAVAIL')";
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname, count(id) as num, qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
<table class='ui cdr selectable celled striped table'>
    <thead>
        <tr class="center aligned">
            <th class="cdrhdr" colspan="3" id="gridHead"><?php echo _('Report outputs join empty -');?><!--Report uscite coda vuota--> <?php filter_summary();?></th>
        </tr>
        <tr>
            <th class="cdrhdr" onclick="getGeneraleJoinempty('', 'period  <?php echo $neworder;?>', 'target=joinempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
            <th class="cdrhdr" onclick="getGeneraleJoinempty('', 'qname  <?php echo $neworder;?>', 'target=joinempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
            <th class="cdrhdr" onclick="getGeneraleJoinempty('', 'num  <?php echo $neworder;?>', 'target=joinempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
        </tr>
    </thead>
    <tbody>
    <?php
    $class = true;
        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[3] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'joinempty', 3, 'getGeneraleJoinempty');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}


function getGeneraleExitempty($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='EXITEMPTY' ";
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname,count(id) as num, max(hold) as max_hold, min(hold) as min_hold, avg(hold) as avg_hold, max(duration) as max_duration, avg(duration) as avg_duration,  max(position) as max_position, avg(position) as avg_position,qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
<table class='ui cdr selectable celled striped table'>
    <thead>
        <tr class="center aligned">
            <th class="cdrhdr" colspan="11" id="gridHead"><?php echo _('Report outputs empty queue -');?><!--Report uscite coda vuota--> <?php filter_summary();?></th>
        </tr>
        <tr class="center aligned">
            <th class="cdrhdr" colspan="3"></th>
            <th class="cdrhdr" colspan="3"><?php echo _('Waiting');?><!--Attesa--></th>
            <th class="cdrhdr" colspan="4"><?php echo _('Position');?><!--Posizione--></th>
        </tr>
        <tr>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'period  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'qname  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'num  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'max_hold  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'min_hold  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'avg_hold  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
            <!--  Posizione quando si e' entrati in coda-->
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'max_duration  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max in</th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'avg_duration  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average in');?><!--Media in--></th>

            <!--  Posizione quando si e' usciti dalla coda-->
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'max_position  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max out</th>
            <th class="cdrhdr" onclick="getGeneraleExitempty('', 'avg_position  <?php echo $neworder;?>', 'target=exitempty,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average out');?><!--Media in--></th>
        </tr>
    </thead>
    <tbody>
    <?php
    $class = true;

        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[10] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '<td >' . FormatTime($row[3]) . '</td>';
            echo '<td >' . FormatTime($row[4]) . '</td>';
            echo '<td >' . FormatTime(nround($row[5], 2)) . '</td>';
            echo "<td >$row[6]</td>";
            echo '<td >' . nround($row[7], 2) . '</td>';
            echo "<td >$row[8]</td>";
            echo '<td >' . nround($row[9], 2) . '</td>';
            echo '</tr>';

            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'exitempty', 11, 'getGeneraleExitempty');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeneraleExitkey($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='EXITWITHKEY' ";
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname,count(id) as num, max(data4) as max_hold, min(data4) as min_hold, avg(data4) as avg_hold, max(duration) as max_duration, avg(duration) as avg_duration,  max(hold) as max_position, avg(hold) as avg_position,qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>

    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr class="center aligned">
                <th colspan="11" id="gridHead"><?php echo _('Report outputs with IVR -');?><!--Report uscite con IVR--> <?php filter_summary();?>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Waiting');?><!--Attesa--></th>
                <th class="cdrhdr" colspan="4"><?php echo _('Position');?><!--Posizione--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'period  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'qname  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'num  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'max_hold  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'min_hold  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'avg_hold  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
                <!--  Posizione quando si e' entrati in coda-->
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'max_duration  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max in</th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'avg_duration  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average in');?><!--Media in--></th>

                <!--  Posizione quando si e' usciti dalla coda-->
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'max_position  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max out</th>
                <th class="cdrhdr" onclick="getGeneraleExitkey('', 'avg_position  <?php echo $neworder;?>', 'target=exitwithkey,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average out');?><!--Media in--></th>
            </tr>
        </thead>
        <tbody>
    <?php
    $class = true;

        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[10] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '<td >' . FormatTime($row[3]) . '</td>';
            echo '<td >' . FormatTime($row[4]) . '</td>';
            echo '<td >' . FormatTime(nround($row[5], 2)) . '</td>';
            echo "<td >$row[6]</td>";
            echo '<td >' . nround($row[7], 2) . '</td>';
            echo "<td >$row[8]</td>";
            echo '<td >' . nround($row[9], 2) . '</td>';
            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'exitwithkey', 11, 'getGeneraleExitkey');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeneraleTimeout($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='EXITWITHTIMEOUT' ";
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname,count(id) as num, max(hold) as max_hold, min(hold) as min_hold, avg(hold) as avg_hold, max(duration) as max_duration, avg(duration) as avg_duration,  max(position) as max_position, avg(position) as avg_position,qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="11" id="gridHead">Report timeout - <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Waiting');?><!--Attesa--></th>
                <th class="cdrhdr" colspan="4"><?php echo _('Position');?><!--Posizione--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'period  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'qname  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'num  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'max_hold  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'min_hold  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'avg_hold  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
                <!--  Posizione quando si e' entrati in coda-->
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'max_duration  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max in</th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'avg_duration  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average in');?><!--Media in--></th>

                <!--  Posizione quando si e' usciti dalla coda-->
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'max_position  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max out</th>
                <th class="cdrhdr" onclick="getGeneraleTimeout('', 'avg_position  <?php echo $neworder;?>', 'target=timeout,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average out');?><!--Media in--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;

            foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
                $row = array_values($row);
                echo "<tr class='cdrdta$class'>";
                echo '<td >' . print_date_by_group($row[0]) . '</td>';
                echo '<td >' . $row[10] . ' (' . $row[1] . ')</td>';
                echo "<td >$row[2]</td>";
                echo '<td >' . FormatTime($row[3]) . '</td>';
                echo '<td >' . FormatTime($row[4]) . '</td>';
                echo '<td >' . FormatTime(nround($row[5], 2)) . '</td>';
                echo "<td >$row[6]</td>";
                echo '<td >' . nround($row[7], 2) . '</td>';
                echo "<td >$row[8]</td>";
                echo '<td >' . nround($row[9], 2) . '</td>';
                echo '</tr>';
                $class = !$class;
            }

            //Contaggio dei risultati per il pager
            $allCount = $count;
            $totalPages = ceil($allCount / ROWS_PER_PAGE);

            echo '</tbody>';

            createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'timeout', 11, 'getGeneraleTimeout');

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeneraleAbbandoni($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='ABANDON' and hold>" . SEC_IGNORE;
    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname,count(id) as num, max(hold) as max_hold, min(hold) as min_hold, avg(hold) as avg_hold, max(duration) as max_duration, avg(duration) as avg_duration,  max(position) as max_position, avg(position) as avg_position,qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#Non ci sono risultati

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr class="center aligned">
                <th colspan="11" id="gridHead"><?php echo _('Report dropouts -');?><!--Report abbandoni--> <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Waiting');?><!--Attesa--></th>
                <th class="cdrhdr" colspan="4"><?php echo _('Position');?><!--Posizione--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'period  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'qname  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'num  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'max_hold  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'min_hold  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'avg_hold  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
                <!--  Posizione quando si e' entrati in coda-->
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'max_duration  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max in</th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'avg_duration  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average in');?><!--Media in--></th>

                <!--  Posizione quando si e' usciti dalla coda-->
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'max_position  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max out</th>
                <th class="cdrhdr" onclick="getGeneraleAbbandoni('', 'avg_position  <?php echo $neworder;?>', 'target=abbandoni,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average out');?><!--Media in--></th>
            </tr>
        </thead>
        <tbody>
    <?php
    $class = true;

        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[10] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '<td >' . FormatTime($row[3]) . '</td>';
            echo '<td >' . FormatTime($row[4]) . '</td>';
            echo '<td >' . FormatTime(nround($row[5], 2)) . '</td>';
            echo "<td >$row[6]</td>";
            echo '<td >' . nround($row[7], 2) . '</td>';
            echo "<td >$row[8]</td>";
            echo '<td >' . nround($row[9], 2) . '</td>';
            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'abbandoni', 11, 'getGeneraleAbbandoni');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeneraleEvase($page, $order = null)
{
    global $dbcdr;
    ob_start();

    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= " true AND action='ANSWER' ";

    $group = group();
    $group_by = " GROUP BY $group,qname ";

    $query = "SELECT timestamp_in as period, qname,count(id) as num, max(hold) as max_hold, min(hold) as min_hold, avg(hold) as avg_hold, max(duration) as max_duration, min(duration) as min_duration, avg(duration) as avg_duration, max(position) as max_position, avg(position) as avg_position,qdescr FROM report_queue  $where $group_by ";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="11" id="gridHead"><?php echo _('Report calls handled -');?><!--Report chiamate evase--> <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Waiting');?><!--Attesa--></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Duration');?><!--Durata--></th>
                <th class="cdrhdr" colspan="2"><?php echo _('Position');?><!--Posizione--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'period  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'qname  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'num  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'max_hold  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'min_hold  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'avg_hold  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'max_duration  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'min_duration  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'avg_duration  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'max_position  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getGeneraleEvase('', 'avg_position  <?php echo $neworder;?>', 'target=evase,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Medium');?><!--Medio--></th>
            </tr>
        </thead>
        <tbody>
    <?php
    $class = true;

        foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo '<td >' . print_date_by_group($row[0]) . '</td>';
            echo '<td >' . $row[11] . ' (' . $row[1] . ')</td>';
            echo "<td >$row[2]</td>";
            echo '<td >' . FormatTime($row[3]) . '</td>';
            echo '<td >' . FormatTime($row[4]) . '</td>';
            echo '<td >' . FormatTime(nround($row[5], 2)) . '</td>';
            echo '<td >' . FormatTime($row[6]) . '</td>';
            echo '<td >' . FormatTime($row[7]) . '</td>';
            echo '<td >' . FormatTime(nround($row[8], 2)) . '</td>';
            echo "<td >$row[9]</td>";
            echo '<td >' . nround($row[10], 2) . '</td>';
            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'evase', 11, 'getGeneraleEvase');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getPerAgente($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where_time = filter() . ' true ';

    $where = $where_time;
//  $where.=" AND action='ANSWER' "; superfluo

    $group = group();
    $group_by = ' GROUP BY ' . STR_AGENT . ",$group,qname ";

    $query = " SELECT ".STR_AGENT.",timestamp_in as period, qname, sum(if(action='ANSWER',1,0)) as answered, sum(if(action='RINGNOANSWER',1,0)) as unanswered, sum(duration) as totcall, max(duration) as max_duration, min(nullif(duration,0)) as min_duration, avg(duration) as avg_duration,qdescr, sum(if(action='ANSWER',1,0))*". AFTER_WORK." as afterwork FROM report_queue_agents $where $group_by ";
    $query_time = ' SELECT ' . STR_AGENT . ",timestamp_in, qname, sum(if(action in ('logon','agent'),timestamp_out-timestamp_in,0)) as work,sum(if(action='pause',timestamp_out-timestamp_in,0)) as pause, COUNT(DISTINCT(DATE(from_unixtime(timestamp_in)))) as logon FROM agentsessions $where_time $group_by ";

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    $result = $dbcdr->getAll($query,DB_FETCHMODE_LAZY);

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr' style='margin-bottom:100px;'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="18" id="gridHead"><?php echo _('Report calls handled by Agent -');?><!--Report chiamate evase per Agente--> <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="5"><?php echo _('Time Activity');?><!--Tempo Attività--></th>
                <th class="cdrhdr" colspan="5"><?php echo _('Load');?><!--Carico--></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Duration');?><!--Durata--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getPerAgente('', 'agent  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Agent');?><!--Agente--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'period  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'qname  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'logon  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Logon Days');?><!--Giorni con Logon--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'work  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Work');?><!--Lavoro--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'pause  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Pause</th>
                <th class="cdrhdr" onclick="getPerAgente('', 'afterwork  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">After call work</th>
                <th class="cdrhdr" onclick="getPerAgente('', 'percentbusy  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Effective');?><!--Effettivo--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'answered  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Reply');?><!--Risp--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'unanswered  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('NoRepl');?><!--NoRisp--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'totcall  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">TotConvers.</th>
                <th class="cdrhdr" onclick="getPerAgente('', 'callminut  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Call/Hour');?><!--Chiam./Ora--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'callminut  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('% Occupation');?><!--% Occupazione--></th>
                <th class="cdrhdr" onclick="getPerAgente('', 'max_duration  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getPerAgente('', 'min_duration  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getPerAgente('', 'avg_duration  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average');?><!--Medio--></th>
            </tr>
        </thead>
        <tbody>
    <?php

    // risultati query:
        // time  0: agente, 1: timestamp_in  2: qname, 3: tempo, 4: pausa
        // base  0: agente, 1: timestamp_in  2: qname,
        // base 3: num chiamate tot.  4: durata totale conversazioni 5: max(duration)  6:min(duration)  7: avg(duration)
        // , max(duration) as max_duration, min(duration) as min_duration, avg(duration) as avg_duration FROM report_queue $where $group_by ";

        foreach ($dbcdr->getAll($query_time, DB_FETCHMODE_ASSOC) as $key => $row) {
            $row = array_values($row);
	    $logon_days[$row[0]][print_date_by_group($row[1])][$row[2]]=$row[5];
            $tempo[$row[0]][print_date_by_group($row[1])][$row[2]] = $row[3];
            $pausa[$row[0]][print_date_by_group($row[1])][$row[2]] = $row[4];
        }
        $class = true;

        foreach ($result as $key => $row) {
            $row = array_values($row);
            echo "<tr class='cdrdta$class'>";
            echo "<td >$row[0]</td>"; //agente
            echo '<td >' . print_date_by_group($row[1]) . '</td>'; // periodo
            //         echo "<td >$row[2]</td>";
            echo '<td >' . $row[9] . ' (' . $row[2] . ')</td>'; // coda

    // tempo attività
            $workdays = workingdays();
            $worksec = $workdays * 8 * 3660; // ipotizzo 8 ore al giorno * 3600 secondi
            $turno = $tempo[$row[0]][print_date_by_group($row[1])][$row[2]];
            if ($turno > 0) {
                $worksec = $turno;
            }
            $pausesec = 0;

            $riposo = $pausa[$row[0]][print_date_by_group($row[1])][$row[2]];
            if ($riposo > 0) {
                $pausesec = nround(($riposo), 2);
            }

	    $aftercall = $row[10];
            $effectivesec = $worksec - $pausesec - $aftercall;

	    echo "<td >".$logon_days[$row[0]][print_date_by_group($row[1])][$row[2]]."</td>";
            echo '<td >' . FormatTime($worksec) . '</td>';
            echo '<td >' . FormatTime($pausesec) . '</td>';
	    echo '<td >' . FormatTime($aftercall) . '</td>';
            echo '<td >' . FormatTime($effectivesec) . '</td>'; // minuti effettivi

    // carico lavoro
            echo "<td >$row[3]</td>";
            echo "<td >$row[4]</td>";
            echo '<td >' . FormatTime($row[5]) . '</td>';
            echo '<td >' . nround(($row[3] / ($effectivesec / 3600)), 2) . '</td>'; // chiamate/ora
            echo '<td >' . nround(($row[5] / $effectivesec), 2) . '</td>'; // percentuale occupazione

    // durata
            echo '<td >' . FormatTime($row[6]) . '</td>';
            echo '<td >' . FormatTime($row[7]) . '</td>';
            try {
                $num = FormatTime(nround($row[5]/$row[3],2));
            } catch (Exception $e) {
                $num = 0;
            }

            echo "<td >".$num."</td>";

            echo '</tr>';
            $class = !$class;
        }

        //Contaggio dei risultati per il pager
        $count_query = "SELECT COUNT(*) FROM agentsessions $where";
        $allCount = $dbcdr->getOne($count_query, DB_FETCHMODE_NUM);
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'report', 14, 'getPerAgente');

        echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();
    return $html;
}

function getSessioniAgente($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= ' true ';

    $query = 'select qname,' . STR_AGENT . ",action,timestamp_in,timestamp_out,reason,qdescr from agentsessions $where ";

    if ($page == -1) {
        $query .= ' ORDER BY qname,agent,timestamp_in';
    } else {
        $query .= " ORDER BY qname,agent,timestamp_in LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    $result = $dbcdr->query($query);

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr' style='margin-bottom:100px;'>
        <thead>
            <tr class="center aligned">
                <th colspan="10" id="gridHead"><?php echo _('Report Sessions Agent -');?><!--Report Sessioni Agente--> <?php filter_summary();?></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'qname  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'agent  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Agent');?><!--Agente--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'action  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Action');?><!--Azione--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'begin  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Start');?><!--Inizio--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'end  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('End');?><!--Fine--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'duration  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Duration');?><!--Durata--></th>
                <th class="cdrhdr" onclick="getSessioniAgente('', 'reason  <?php echo $neworder;?>', 'target=report,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Reason');?><!--Motivo--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;

            foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
                $row = array_values($row);
                try {
                    $out = '';
                    $out.= "<tr class='cdrdta$class'>";
                    $out.=  '<td >' . $row[6] . ' (' . $row[0] . ')</td>';
                    $out.=  "<td >$row[1]</td>";
                    $out.= "<td >$row[2]</td>";
                    $out.=  '<td >' . date('d-m-Y H:i:s', $row[3]) . '</td>';
                    $out.=  '<td >' . date('d-m-Y H:i:s', $row[4]) . '</td>';
                    $out.=  '<td >' . FormatTime($row[4] - $row[3]) . '</td>';
                    if ($row[2]=='pause') {
                        $out.=  "<td >$row[5]</td>";
                    } else {
                        $out.=  "<td ></td>";
                    }
                    $out.=  '</tr>';
                    $class = !$class;
                    echo $out;
                } catch (Exception $e) {}
            }

            //Contaggio dei risultati per il pager
            $count_query = "SELECT COUNT(*) FROM agentsessions $where";
            $allCount = $dbcdr->getOne($count_query, DB_FETCHMODE_NUM);

            $totalPages = ceil($allCount / ROWS_PER_PAGE);

            echo '</tbody>';
            createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'report', 10, 'getSessioniAgente');

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getPerChiamante($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= ' true ';
    // $where.=" true AND action='ANSWER' "; tolgo action=answer, ho semplificato la query con solo enterque, carico troppo alto

    $group = group();
    $group_by = " GROUP BY cid,$group,qname,action ";

    $query = "SELECT cid,timestamp_in as period, qname, action, count(id) as num, max(position) as max_position, min(position) as min_position, avg(position) as avg_position, qdescr FROM report_queue_callers $where $group_by";

    $result = $dbcdr->query($query);

    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr' style='margin-bottom:100px;'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="11" id="gridHead"><?php echo _('Report calls handled by Caller -');?><!--Report chiamate evase per Chiamate--> <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="5"></th>
                <th class="cdrhdr" colspan="3"><?php echo _('Position');?><!--Posizione--></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getPerChiamante('', 'cid  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Caller');?><!--Chiamante--></th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'period  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'qname  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'action  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Action');?><!--Action--></th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'num  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'max_position  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Max</th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'min_position  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Min</th>
                <th class="cdrhdr" onclick="getPerChiamante('', 'avg_position  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Average');?><!--Medio--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;

            foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
                $row = array_values($row);
                echo "<tr class='cdrdta$class'>";
                echo "<td >$row[0]</td>";
                echo '<td >' . print_date_by_group($row[1]) . '</td>';
                echo '<td >' . $row[8] . ' (' . $row[2] . ')</td>';
                echo "<td >$row[3]</td>";
                echo "<td >$row[4]</td>";
                echo "<td >$row[5]</td>";
                echo "<td >$row[6]</td>";
                echo '<td >' . nround($row[7], 2) . '</td>';

                echo '</tr>';
                $class = !$class;
            }

            //Contaggio dei risultati per il pager
            $count_query = "SELECT COUNT(*) FROM report_queue_callers $where";
            $allCount = $dbcdr->getOne($count_query, DB_FETCHMODE_NUM);
            $totalPages = ceil($allCount / ROWS_PER_PAGE);

            if ($totalPages == 1) {
                $_SESSION['page'] = 1;
            }

            echo '</tbody>';

            createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'reports', 7, 'getPerChiamante');

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getPerChiamata($page, $order = 'timestamp_in DESC')
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= ' true ';

    $query = "SELECT DATE_FORMAT(FROM_UNIXTIME(`timestamp_in`), '%d/%m/%Y %H:%i:%s') as time, cid, qdescr, qname, agent, position, SEC_TO_TIME(hold) as hold, SEC_TO_TIME(duration) as duration, action, data4 FROM report_queue $where";
    if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    $result = $dbcdr->getAll($query, DB_FETCHMODE_ASSOC);

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr' style='margin-bottom:100px;'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="10" id="gridHead"><?php echo _('Report calls handled by Call -');?><!--Report chiamate evase per Chiamata--> <?php filter_summary();?></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getPerChiamata('', 'timestamp_in  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Time');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'cid  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Caller');?><!--Chiamante--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'qname  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'agent  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Agent');?><!--Risultato--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'position  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Position');?><!--Risultato--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'hold  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Hold');?><!--Medio--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'duration  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Duration');?><!--Medio--></th>
                <th class="cdrhdr" onclick="getPerChiamata('', 'action  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Result');?><!--Risultato--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;

            foreach ($result as $key => $row) {
                $row = array_values($row);
                echo "<tr class='cdrdta$class'>";
                echo "<td >$row[0]</td>";
                if($row[8]!='FULL' && $row[8]!='JOINEMPTY') {
                    echo "<td >$row[1]</td>";
                } else {
                    echo "<td >$row[5]</td>";
                }
                echo '<td >' . $row[2] . ' (' . $row[3] . ')</td>';
                echo "<td >$row[4]</td>";
                if($row[8]!='EXITWITHKEY' && $row[8]!='FULL' && $row[8]!='JOINEMPTY') {
                    echo "<td style='text-align:center'>$row[5]</td>";
                    echo "<td style='text-align:center'>$row[6]</td>";
                    echo "<td style='text-align:center'>$row[7]</td>";
                } elseif ($row[8]=='EXITWITHKEY') {
                    echo "<td style='text-align:center'>$row[5]</td>";
                    echo "<td style='text-align:center'>".gmdate("H:i:s", $row[9])."</td>";
                    echo "<td style='text-align:center'>$row[7]</td>";
                } else {
                    echo "<td style='text-align:center'></td>";
                    echo "<td style='text-align:center'></td>";
                    echo "<td style='text-align:center'></td>";
                }

                echo "<td >$row[8]</td>";

                echo '</tr>';
                $class = !$class;
            }

            //Contaggio dei risultati per il pager
            $count_query = "SELECT COUNT(*) FROM report_queue $where";
            $allCount = $dbcdr->getOne($count_query, DB_FETCHMODE_NUM);
            $totalPages = ceil($allCount / ROWS_PER_PAGE);

            if ($totalPages == 1) {
                $_SESSION['page'] = 1;
            }

            echo '</tbody>';

            createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'reports', 7, 'getPerChiamata');

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}
function getIvr($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $filter = filter();

    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            $select_field = ' DATE_FORMAT(time,"%m-%Y") as period ';
            break;

        case GROUP_WEEK:
            $select_field = ' DATE_FORMAT(time,"%u-%Y") as period ';
            break;

        case GROUP_DAY:
            $select_field = ' DATE_FORMAT(time,"%d-%m-%Y") as period ';
            break;

        default:
        case GROUP_YEAR:
            $select_field = ' DATE_FORMAT(time,"%Y") as period ';
            break;
    }

    if ($_SESSION['filter'][1]) {
        $time_in = date("Y-m-d H:i:s.u",strtotime($_SESSION['filter'][1]));
        $time_out = date("Y-m-d H:i:s.u",strtotime($_SESSION['filter'][2]));
        $ivr_name = $_SESSION['filter'][3];
        $where = " AND  time < '$time_out' AND time >'$time_in' AND data4 like '%$ivr_name%' ";
    }

    $query = "SELECT $select_field, data3 AS ivr_id, data2 AS choice, count(*) AS tot, data4 AS ivr_name FROM queue_log_history WHERE queuename = 'NONE' AND agent = 'NONE' AND event = 'INFO' AND data1 = 'IVRAPPEND' $where GROUP BY period,ivr_id,choice";

   if ($page == -1) {
        $query .= " ORDER BY {$_SESSION['order']}";
    } else {
        $query .= " ORDER BY {$_SESSION['order']} LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>

    <table class='ui selectable striped celled table'>
        <thead>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="10" id="gridHead"><?php echo _('Call report IVR -');?><!--Report chiamate IVR--> <?php filter_summary();?></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getIvr('', 'period  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getIvr('', 'ivr_id  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" >IVR</th>
                <th class="cdrhdr" onclick="getIvr('', 'choice  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Choice');?><!--Scelta--></th>
                <th class="cdrhdr" onclick="getIvr('', 'tot  <?php echo $neworder;?>', 'target=reports,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)">Num</th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;

            foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
                $row = array_values($row);
                echo "<tr class='cdrdta$class'>";
                echo "<td >$row[0]</td>";
                echo "<td >$row[4] ($row[1])</td>";
                echo "<td >$row[2]</td>";
                echo "<td >$row[3]</td>";

                echo '</tr>';
                $class = !$class;
            }

        //Contaggio dei risultati per il pager
        $allCount = $count;
        $totalPages = ceil($allCount / ROWS_PER_PAGE);

        echo '</tbody>';

        createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'reports', 3, 'getIvr');

        echo '</table>';

        $html = ob_get_contents();
        ob_end_clean();

        return $html;
}

function getQoS($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $where = filter();
    $where .= " true AND action='ANSWER' ";
    $sql = "SELECT count(*)  from report_queue $where" . $i;
    $row = $dbcdr->getOne($sql);
    $total = $row;
    if ($total == 0) {
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }
    for ($i = 5; $i <= 95; $i += 15) {
        $sql = "SELECT count(*)  from report_queue $where AND hold<" . $i;
        $row = $dbcdr->getOne($sql);
        $rows["$i"][0] = $row;
        $rows["$i"][1] = ($row / $total) * 100;
    }
    ?>
    <table class='ui selectable striped celled table cdr' cellpadding="5">
        <thead>
            <tr class="center aligned">
                <th colspan="3" id="gridHead"><?php echo _('Quality of service -');?><!--Qualità del servizio--> <?php filter_summary();?></th>
            </tr>
            <tr>
                <th class="cdrhdr"><?php echo _('Response time');?><!--Tempo di risposta--></th>
                <th class="cdrhdr"><?php echo _('Number answers');?><!--Numero risposte--></th>
                <th class="cdrhdr"><?php echo _('Percentage');?><!--Percentuale--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;
            foreach ($rows as $key => $value) {
                echo "<tr class='cdrdta$class'><td>Entro $key secondi</td><td>$value[0]</td><td>" . number_format($value[1], 2) . '%</td></tr>';
                $class = !$class;
            }

            echo '</tbody></table>';
    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getPerformance($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where_evase = $where . " true AND action='ANSWER' ";
    $where_fallite = $where . " true AND (action='ABANDON' and hold>" . SEC_IGNORE . ')';
    $where_nulle = $where . " true AND (action='ABANDON' and hold<=" . SEC_IGNORE . ')';
    $where_good = $where . " true AND (action='ANSWER' and hold<" . SEC_GOOD . ')';
    $where_timeout = $where . " true AND action = 'EXITWITHTIMEOUT' ";
    $where_exitempty = $where . " true AND action = 'EXITEMPTY' ";
    $where_exitkey = $where . " true AND action = 'EXITWITHKEY' ";
    $where_full = $where . " true AND action = 'FULL' ";
    $where_joinempty = $where . " true AND action = 'JOINEMPTY' ";

//   $group = group();
    //   $group_by = " GROUP BY $group,qname ";
    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y-%m") as period ';
            $date_format = 'm-Y';
            break;

        case GROUP_WEEK:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y-%u") as period ';
            $date_format = 'W-Y';
            break;

        case GROUP_DAY:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y-%m-%d") as period ';
            $date_format = 'd-m-Y';
            break;

        default:
        case GROUP_YEAR:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y") as period ';
            $date_format = 'Y';
            break;
    }

    $group_by = ' GROUP BY period,qname';

    //evase
    $query_evase = "SELECT $select_field, qname, count(id) from report_queue $where_evase $group_by";
    $result = $dbcdr->query($query_evase);

    //tot fallite
    $query_fallite = "SELECT $select_field, qname, count(id) from report_queue $where_fallite $group_by";

    //non evase -> nulle
    $query_nulle = "SELECT $select_field, qname, count(id) from report_queue $where_nulle $group_by";

    //buone: hanno ottenuto risposta in meno di SEC_GOOD
    $query_good = "SELECT $select_field, qname, count(id) from report_queue $where_good $group_by";

    //attesa e durate
    $query_durate = "SELECT $select_field, qname, max(hold) as max_hold, min(hold) as min_hold, avg(hold) as avg_hold, max(duration) as max_duration, min(nullif(duration,0)) as min_duration, avg(duration) as avg_duration,qdescr FROM report_queue $where_evase $group_by";

    //timeout
    $query_timeout = "SELECT $select_field, qname, count(id) from report_queue $where_timeout $group_by";

    //exitempty
    $query_exitempty = "SELECT $select_field, qname, count(id) from report_queue $where_exitempty $group_by";

    //exitkey
    $query_exitkey = "SELECT $select_field, qname, count(id) from report_queue $where_exitkey $group_by";

    //full
    $query_full = "SELECT $select_field, qname, count(id) from report_queue $where_full $group_by";

    //joinempty
    $query_joinempty = "SELECT $select_field, qname, count(id) from report_queue $where_joinempty $group_by";

    if ($page == -1) {
        $limit = '';
    } else {
        $limit = " LIMIT $sublimit, " . ROWS_PER_PAGE;
    }

    $queue_names = array();
    foreach ($dbcdr->getAll('select distinct qname,qdescr from report_queue', DB_FETCHMODE_ASSOC) as $row) {
        $queue_names[$row['qname']] = $row['qdescr'];
    }

    $queues = array();
    $periods = array();
    $query_evase .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_evase, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $evase[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer evase per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_fallite .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_fallite, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $abandon[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_timeout .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_timeout, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $timeout[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_exitempty .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_exitempty, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $exitempty[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_exitkey .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_exitkey, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $exitkey[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_full .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_full, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $full[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_joinempty .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_joinempty, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $joinempty[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_nulle .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_nulle, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $null[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer fail non considerabili
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_good .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_good, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $good[$line_clid[0]][$line_clid[1]] = $line_clid[2]; //numer good per periodo/coda
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    $query_durate .= " ORDER BY {$_SESSION['order']}" . $limit;
    foreach ($dbcdr->getAll($query_durate, DB_FETCHMODE_ASSOC) as $key => $line_clid) {
        $line_clid = array_values($line_clid);
        $min_h[$line_clid[0]][$line_clid[1]] = $line_clid[3];
        $max_h[$line_clid[0]][$line_clid[1]] = $line_clid[2];
        $avg_h[$line_clid[0]][$line_clid[1]] = $line_clid[4];
        $max_d[$line_clid[0]][$line_clid[1]] = $line_clid[5];
        $min_d[$line_clid[0]][$line_clid[1]] = $line_clid[6];
        $avg_d[$line_clid[0]][$line_clid[1]] = $line_clid[7];
        if (!in_array($line_clid[1], $queues)) {
            $queues[] = $line_clid[1];
        }
        if (!in_array($line_clid[0], $periods)) {
            $periods[] = $line_clid[0];
        }
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr class="center aligned">
                <th colspan="29" id="gridHead"><?php echo _('Performance statistics -');?><!--Statistiche performance--> <?php filter_summary();?></th>
            </tr>
            <tr class="center aligned">
                <th class="cdrhdr" colspan="3"></th>
                <th class="cdrhdr" colspan="4"><span title="Chiamate Risposte"><?php echo _('Processed');?><!--Evase--></span></th>
                <th class="cdrhdr" colspan="14"><span title="Chiamate non risposte"><?php echo _('Not processed');?><!--Non evase--></span></th>
                <th class="cdrhdr" colspan="2"><span title="Chiamate entrate in coda ma chiuse prima che l'attesa minima sia trascorsa"><?php echo _('Null');?><!--Nulle--></span></th>
                <th class="cdrhdr" colspan="3"><span title="Tempo trascorso in coda prima della risposta"><?php echo _('Waiting');?><!--Attesa--></span></th>
                <th class="cdrhdr" colspan="3"><span title="Durata della chiamata"><?php echo _('Duration');?><!--Durata--></span></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="getPerformance('', 'period  <?php echo $neworder;?>', 'target=performance,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Periodo--></th>
                <th class="cdrhdr" onclick="getPerformance('', 'qname  <?php echo $neworder;?>', 'target=performance,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><span title="Numero Coda"><?php echo _('Queue');?><!--Coda--></span></th>
                <th class="cdrhdr"><span title="Chiamate entrate in Coda"><?php echo _('Incoming');?><!--Entrate--></span></th>

                <th class="cdrhdr" ><span title="Totale chiamate evase">Tot</th>
                <th class="cdrhdr" ><span title="Percentuale sul totale delle chiamate entrate in Coda">%</span></th>
                <th class="cdrhdr" ><span title="Chiamate risposte entro i 60 secondi di attesa"> &lt; 60 sec </span></th>
                <th class="cdrhdr" ><span title="Chiamate risposte entro i 60 secondi di attesa">%</span></th>
                <th class="cdrhdr" ><span title="Totale chiamate non evase">Tot</span></th>
                <th class="cdrhdr" ><span title="Percentuale sul totale delle chiamate non evase">%</span></th>
                <th class='cdrhdr' ><span title="Chiamate chiuse prima di ricevere risposta"><?php echo _('Dropouts');?><!--Abbandoni--></span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate che hanno abbandonato la Coda">%</span></th>
                <th class='cdrhdr' ><span title="Chiamate uscite dalla Coda alla scadenza del timeout">Timeout</span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate uscite dalla Coda per timeout">%</span></th>
                <th class='cdrhdr' ><span title="Chiamate uscite dalla Coda per l'assenza di agenti"><?php echo _('No Agents');?><!--No Agenti--></span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate uscite dalla Coda per l'assenza di agenti">%</span></th>
                <th class='cdrhdr' ><span title="Chiamate uscite dalla Coda usando il menù di uscita"><?php echo _('Exit');?><!--Uscita--></span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate uscite dalla Coda tramite il menù di uscita">%</span></span></th>
                <th class='cdrhdr' ><span title="Chiamate non entrate per Coda piena"><?php echo _('Full');?><!--Uscita--></span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate non entrate in Coda per coda piena">%</span></span></th>
                <th class='cdrhdr' ><span title="Chiamate non entrate per Coda vuota"><?php echo _('Empty');?><!--Uscita--></span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate non entrate in Coda per coda vuota">%</span></span></th>
                <th class="cdrhdr" ><span title="Totale chiamate nulle">Tot</span></th>
                <th class='cdrhdr' ><span title="Percentuale sul totale delle chiamate nulle">%</span></th>

                <th class="cdrhdr" >Min</th>
                <th class="cdrhdr" >Max</th>
                <th class="cdrhdr" ><?php echo _('Medium');?><!--Medio--></th>

                <th class="cdrhdr" >Min</th>
                <th class="cdrhdr" >Max</th>
                <th class="cdrhdr" ><?php echo _('Medium');?><!--Medio--></th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;
            $tot_tot = 0;
            $tot_fallite = 0;
            asort($periods);
            foreach ($queues as $queue) {
                foreach ($periods as $period) {
                    $totfail = $timeout[$period][$queue] + $abandon[$period][$queue] + $exitempty[$period][$queue] + $exitkey[$period][$queue] + $full[$period][$queue] + $joinempty[$period][$queue];
                    $tot = $evase[$period][$queue] + $totfail + $null[$period][$queue];

                    //evitiamo la divisione per zero nel calcolo delle percentuali
                    if ($tot == 0) {
                        $tot = 1;
                    }
                    echo "<tr class='cdrdta$class'>";
                    switch ($_SESSION['group']) {
                        case GROUP_MONTH:
                            echo '<td >' . date($date_format, strtotime($period)) . '</td>';
                            break;

                        case GROUP_WEEK:
                            $period2 = str_replace('-', 'W', $period);
                            $period2 = strtotime($period2);
                            echo '<td >' . print_date_by_group($period2) . '</td>';
                            break;

                        case GROUP_DAY:
                            echo '<td >' . date($date_format, strtotime($period)) . '</td>';
                            break;

                        default:
                        case GROUP_YEAR:
                            echo '<td >' . $period . '</td>';
                            break;
                    }
        //      echo "<td >".date($date_format,strtotime($period))."</td>";
                    echo "<td >${queue_names[$queue]} ($queue)</td>";
                    echo "<td >$tot</td>"; //entrate

                    //evase
                    echo '<td >' . $evase[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $evase[$period][$queue]) / $tot), 2) . '%</td>';

                    echo '<td >' . $good[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $good[$period][$queue]) / $tot), 2) . '%</td>';

                    //non evase
                    echo '<td >' . $totfail . '</td>';
                    echo '<td >' . nround(((100 * $totfail) / $tot), 2) . '%</td>';
                    echo '<td >' . $abandon[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $abandon[$period][$queue]) / $tot), 2) . '%</td>';
                    echo '<td >' . $timeout[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $timeout[$period][$queue]) / $tot), 2) . '%</td>';
                    echo '<td >' . $exitempty[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $exitempty[$period][$queue]) / $tot), 2) . '%</td>';
                    echo '<td >' . $exitkey[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $exitkey[$period][$queue]) / $tot), 2) . '%</td>';
                    echo '<td >' . $full[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $full[$period][$queue]) / $tot), 2) . '%</td>';
                    echo '<td >' . $joinempty[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $joinempty[$period][$queue]) / $tot), 2) . '%</td>';

                    //nulle
                    echo '<td >' . $null[$period][$queue] . '</td>';
                    echo '<td >' . nround(((100 * $null[$period][$queue]) / $tot), 2) . '%</td>';

                    //attesa
                    echo '<td >' . FormatTime($min_h[$period][$queue]) . '</td>';
                    echo '<td >' . FormatTime($max_h[$period][$queue]) . '</td>';
                    echo '<td >' . FormatTime(nround($avg_h[$period][$queue], 2)) . '</td>';

                    //durata
                    echo '<td >' . FormatTime($min_d[$period][$queue]) . '</td>';
                    echo '<td >' . FormatTime($max_d[$period][$queue]) . '</td>';
                    echo '<td >' . FormatTime(nround($avg_d[$period][$queue], 2)) . '</td>';
                    $class = !$class;
                    echo '</tr>';
                }
            }

            //Contaggio dei risultati per il pager
            $allCount = $count;
            $totalPages = ceil($allCount / ROWS_PER_PAGE);

            echo '</tbody>';

            createPager($allCount, $totalPages, ROWS_PER_PAGE, $page, 'performance', 16, 'getPerformance');

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getOrariaTotali($page, $order = null)
{
    return getOraria($page, $order, 'totali');
}

function getOrariaInevase($page, $order = null)
{
    return getOraria($page, $order, 'inevase');
}

function getOrariaEvase($page, $order = null)
{
    return getOraria($page, $order, 'evase');
}

function getOrariaNonGestite($page, $order = null)
{
    return getOraria($page, $order, 'nongestite');
}

function getOrariaNulle($page, $order = null)
{
    return getOraria($page, $order, 'nulle');
}

function getOraria($page, $order, $target)
{
    $target_func = 'getOraria' . ucfirst($target);
    global $dbcdr;
    ob_start();
    //#### inizializzazione variabili per la paginazione e l'ordinamento
    if ($order != null) {
        $_SESSION['order'] = $order;
    } else {
        $_SESSION['order'] = DEFAULT_ORDER;
    }

    if ($page != '' && $page != -1) {
        $_SESSION['page'] = $page;
    }

    $sublimit = ($_SESSION['page'] - 1) * PERIODS_PER_PAGE;

    //## Start filter
    $where = filter();
    switch ($target) {
        case 'evase':
            $where .= " true AND action='ANSWER' ";
            break;

        case 'inevase':
            $where .= " true AND ((action='EXITWITHTIMEOUT') or (action='EXITWITHKEY') or (action='EXITEMPTY') or (action='ABANDON' and hold>" . SEC_IGNORE . ')) ';
            break;

        case 'nongestite':
            $where .= " true AND ((action='FULL') or (action='JOINEMPTY')) ";
            break;

        case 'nulle':
            $where .= " true AND ((action='ABANDON' and hold<" . SEC_IGNORE . ')) ';
            break;

        case 'totali':
            $where .= ' true';
            break;
    }

    switch ($_SESSION['group']) {
        case GROUP_MONTH:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%m-%Y") as period ';
            break;

        case GROUP_WEEK:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%u-%Y") as period ';
            break;

        case GROUP_DAY:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%d-%m-%Y") as period ';
            break;

        default:
        case GROUP_YEAR:
            $select_field = ' DATE_FORMAT(from_unixtime(timestamp_in),"%Y") as period ';
            break;
    }
    $group_by = ' GROUP BY period,qname,hour ';

    $query = "SELECT $select_field, qname, hour(from_unixtime(timestamp_in)) as hour, count(id) as count from report_queue $where $group_by";
    $query .= ' ORDER BY timestamp_in  ';

    $queue_names = array();
    foreach ($dbcdr->getAll('select distinct qname,qdescr from report_queue', DB_FETCHMODE_ASSOC) as $row) {
        $queue_names[$row['qname']] = $row['qdescr'];
    }

    //evita warning sul tipo
    $queues = array();
    $periods = array();

    foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        $evase[$row[0]][$row[1]][$row[2]] = $row[3]; //numer evase per periodo/coda
        if ($row[1] != '' && !in_array($row[1], $queues)) {
            $queues[] = $row[1];
        }
        if ($row[0] != '' && !in_array($row[0], $periods)) {
            $periods[] = $row[0];
        }
    }

    //Contaggio dei risultati per il pager
    if ($page == -1) {
        $toshow = $evase;
    } else {
        $allCount = sizeof($periods);
        $totalPages = ceil($allCount / PERIODS_PER_PAGE);
        if (sizeof($evase) > 0 && count($evase) > PERIODS_PER_PAGE) {
            $toshow = array_slice($evase, $sublimit, PERIODS_PER_PAGE);
        } else {
            $toshow = $evase;
        }
    }
    //non stampiamo tabelle vuote
    if (sizeof($toshow) == 0) {
        $html = ob_get_contents();
        ob_end_clean();

        return $html;
    }

    //#### Generazione tabella
    //Per avere un aspetto grafico decente, ogni volta bisogna ridisegnare anche l'intestazione della tabella

    if (strpos($order, 'ASC') !== false) {
        $neworder = 'DESC';
    } else {
        $neworder = 'ASC';
    }
    ?>
    <table class='ui selectable striped celled table cdr'>
        <thead>
            <tr>
                <th class="center aligned" colspan="15" id="gridHead"><?php echo _('Distribution hourly calls');?><!--Distribuzione oraria chiamate--> <?php echo $target;?> - <?php filter_summary();?></th>
            </tr>
            <tr>
                <th class="cdrhdr" onclick="<?php echo $target_func;?>('', 'period  <?php echo $neworder;?>', 'target=<?php echo $target;?>,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)" ><?php echo _('Period');?><!--Perido--></th>
                <th class="cdrhdr" onclick="<?php echo $target_func;?>('', 'qname  <?php echo $neworder;?>', 'target=<?php echo $target;?>,preload=listing');" onmouseover="GridHeader('over', this)" onmouseout="GridHeader('out', this)"><?php echo _('Queue');?><!--Coda--></th>
                <?php
                for ($i = ORA_INIZIO; $i < ORA_FINE; ++$i) {
                        echo "<th class='cdrhdr'>$i - " . ($i + 1) . '</th>';
                    }
                    ?>
                <th class="cdrhdr">Tot</th>
            </tr>
        </thead>
        <tbody>
        <?php
        $class = true;
            foreach ($toshow as $period => $queues) {
                foreach ($queues as $queue => $ore) {
                    $all += sizeof($queues);
                    $tot = 0;
                    echo "<tr class='cdrdta$class'>";
                    echo "<td >$period</td>";
                    echo "<td >${queue_names[$queue]} ($queue)</td>";
                    for ($k = ORA_INIZIO; $k < ORA_FINE; ++$k) {
                        $tot += $ore[$k];
                        echo '<td >' . $ore[$k] . '</td>';
                    }
                    echo "<td >$tot</td>";
                    echo '</tr>';
                    $class = !$class;
                }
            }

            echo '</tbody>';

            createPager($allCount, $totalPages, PERIODS_PER_PAGE, $page, $target, 15, $target_func);

            echo '</table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

function getGeografica($page, $order = null)
{
    global $dbcdr;
    ob_start();
    $sublimit = setOrderAndPage($page, $order);

    //## Start filter
    $where = filter();
    $where .= ' true ';

    $select_field = select();
    $zona = selectZone();
    if ($zona == '') {
        $zona = 'regione';
    }
    $zona_fields = $zona;

    $testata = '<tr><th class="cdrhdr">' . _('Period') . '</th><th  class="cdrhdr">' . _('Queue') . '</th><th  class="cdrhdr">' . _('Region') . '</th><th  class="cdrhdr">' . _('Total Calls') . '</th></tr>';

    if ($zona == 'siglaprov') {
        $zona_fields = 'regione,siglaprov';
        $testata = '<tr><th class="cdrhdr">' . _('Period') . '</th><th  class="cdrhdr">' . _('Queue') . '</th><th  class="cdrhdr">' . _('Region') . '</th><th  class="cdrhdr">Prov</th><th class="cdrhdr">' . _('Total Calls') . '</th></tr>';
    }
    if ($zona == 'prefisso') {
        $zona_fields = 'regione,siglaprov,prefisso';
        $testata = '<tr><th class="cdrhdr">' . _('Period') . '</th><th  class="cdrhdr">' . _('Queue') . '</th><th  class="cdrhdr">' . _('Region') . '</th><th  class="cdrhdr">Prov</th><th  class="cdrhdr">Pref</th><th class="cdrhdr">' . _('Total Calls') . '</th></tr>';
    }

    $group_by = " GROUP BY period,qname,$zona_fields ";

    $queue_names = array();
    foreach ($dbcdr->getAll('select distinct qname,qdescr from report_queue', DB_FETCHMODE_ASSOC) as $row) {
        $queue_names[$row['qname']] = $row['qdescr'];
    }

    $query = "SELECT $select_field, qname, $zona_fields, count(id) as num  FROM report_queue_callers $where $group_by order by year(from_unixtime(timestamp_in)),month(from_unixtime(timestamp_in)),day(from_unixtime(timestamp_in)),$zona_fields";

    echo "<table class='ui selectable striped celled table cdr'><thead>";
    echo "$testata </thead>";
    echo '<tobdy>';
    foreach ($dbcdr->getAll($query, DB_FETCHMODE_ASSOC) as $key => $row) {
        $row = array_values($row);
        switch ($zona) {
            case 'siglaprov':
                echo '<tr><td>' . $row[0] . '</td><td>' . $queue_names[$row[1]] .' ('.$row[1].')' . '</td><td>' . $row[2] . '</td><td>' . $row[3] . '</td><td>' . $row[4] . '</td></tr>';
                break;

            case 'prefisso':
                echo '<tr><td>' . $row[0] . '</td><td>' . $queue_names[$row[1]] .' ('.$row[1].')'. '</td><td>' . $row[2] . '</td><td>' . $row[3] . '</td><td>' . $row[4] . '</td><td>' . $row[5] . '</td></tr>';
                break;

            default:
                echo '<tr><td>' . $row[0] . '</td><td>' . $queue_names[$row[1]] .' ('.$row[1].')' . '</td><td>' . $row[2] . '</td><td>' . $row[3] . '</td></tr>';
        }
    }
    echo '</tbody></table>';

    $html = ob_get_contents();
    ob_end_clean();

    return $html;
}

?>
