var line = {
  target: {
    backgroundColor: "transparent"
  },
  series: [{
    shadow: false,
    showMarker: true,
    markerOptions: {
      shadow: false
    }
  }],
  title: {
    textColor: "rgb(102, 102, 102)",
    fontFamily: "'Open sans', sans-serif",
    fontSize: "16px",
    fontWeight: "700"
  },
  grid: {
    backgroundColor: '#fafafa',
    gridLineColor: '#ddd',
    gridLineWidth: 1,
    borderWidth: 0,
    shadow: false
  },
  axes: {
    xaxis: {
      borderWidth: 0,
      ticks: {
        show: true,
        showGridline: true,
        showLabel: true,
        showMark: true,
        size: 5,
        textColor: "",
        whiteSpace: "nowrap",
        fontSize: "14px",
        fontFamily: "'Open sans',sans-serif"
      },
      label: {
        textColor: "#000",
        whiteSpace: "normal",
        fontSize: "12px",
        fontFamily: "'Open sans',sans-serif",
        fontWeight: "400"
      }
    },
    yaxis: {
      borderWidth: 0,
      ticks: {
        show: true,
        showGridline: true,
        showLabel: true,
        showMark: true,
        size: 5,
        textColor: "",
        whiteSpace: "nowrap",
        fontSize: "12px",
        fontFamily: "'Open sans',sans-serif"
      },
      label: {
        textColor: "#000",
        whiteSpace: "nowrap",
        fontSize: "10pt",
        fontFamily: "'Open sans',sans-serif",
        fontWeight: "400"
      }
    }
  }
};

var bar = {
  series: [{
    color: '#4bb2c5',
    highlightColors: [],
    shadow: false,
    barWidth: 100
  }],
  title: {
    textColor: "rgb(102, 102, 102)",
    fontFamily: "'Open sans', sans-serif",
    fontSize: "16px",
    fontWeight: "700"
  },
  grid: {
    backgroundColor: '#fafafa',
    gridLineColor: '#ddd',
    gridLineWidth: 1,
    borderWidth: 0,
    shadow: false
  },
  axes: {
    xaxis: {
      borderWidth: 0,
      ticks: {
        show: true,
        showGridline: true,
        showLabel: true,
        size: 4,
        textColor: "",
        whiteSpace: "nowrap",
        fontSize: "14px",
        fontFamily: "'Open sans',sans-serif"
      },
      label: {
        textColor: "#000",
        whiteSpace: "normal",
        fontSize: "14px",
        fontFamily: "'Open sans',sans-serif",
        fontWeight: "400"
      }
    },
    yaxis: {
      borderWidth: 0,
      ticks: {
        show: true,
        showGridline: true,
        showLabel: true,
        showMark: true,
        size: 5,
        textColor: "",
        whiteSpace: "nowrap",
        fontSize: "12px",
        fontFamily: "'Open sans',sans-serif"
      },
      label: {
        textColor: "#000",
        whiteSpace: "nowrap",
        fontSize: "10pt",
        fontFamily: "'Open sans',sans-serif",
        fontWeight: "400"
      }
    }
  }
};

var pie = {
  seriesStyles: {
    // series: ["#F1948A", "#BB8FCE", "#85C1E9", "#73C6B6", "#82E0AA", "#F8C471", "#E59866", "#3498DB", "#D4AC0D", "#B2BABB"],
    // highlighter: ["#F5B7B1", "#E8DAEF", "#D6EAF8", "#D0ECE7", "#D5F5E3", "#FDEBD0", "#F6DDCC", "#85C1E9", "#F7DC6F", "#F2F4F4"],
    shadow: false,
    startAngle: 270,
    padding: 20,
    sliceMargin: 2,
    fill: true
  },
  grid: {
    backgroundColor: '#fafafa',
    gridLineColor: '#ddd',
    gridLineWidth: 1,
    borderWidth: 0,
    shadow: false
  },
  title: {
    textColor: "rgb(102, 102, 102)",
    fontFamily: "'Open sans', sans-serif",
    fontSize: "16px",
    fontWeight: "700"
  }
};

$(document).ready(function() {

  // init graphic components
  $('.ui.sidebar')
    .sidebar({
      context: $('.bottom.segment'),
      dimPage: false,
      closable: false
    })
    .sidebar('setting', 'transition', 'push')
    .sidebar('attach events', '#sidebar-button');

  $('.ui.checkbox').checkbox();

  $('.popup').popup();

  // stretch page_body
  $("#sidebar-button").click(function() {
    $("#page_body").toggleClass('closed-sidebar');
  });
});
