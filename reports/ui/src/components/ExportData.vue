<template>
  <div v-if="isVisible && data && data.length > 1" class="right-floated mt-30m">
    <!-- button only csv if is table or recap -->
    <sui-popup
      v-if="type === 'table' || type === 'recap' || type === 'rank'"
      :content="$t('command.export_csv')"
    >
      <sui-button
        @click="exportToCSV()"
        class="custom-btn"
        basic
        icon="download"
        slot="trigger"
      />
    </sui-popup>
    <!-- dropdown for csv and pdf export -->
    <sui-popup
      v-else
      :content="$t('command.export')"
    >
      <sui-dropdown
        class="icon basic"
        :class="{ transparent: transparent }"
        icon="download"
        button
        pointing="top right"
        slot="trigger"
      >
        <sui-dropdown-menu>
          <sui-dropdown-item @click="exportToCSV()">{{ $t("command.export_csv") }}</sui-dropdown-item>
          <sui-dropdown-item v-if="isPdf" @click="exportToPDFPNG('canvas', {'file_type': 'pdf'})">{{ $t("command.export_pdf") }}</sui-dropdown-item>
          <sui-dropdown-item v-if="isPng" @click="exportToPDFPNG('canvas', {'file_type': 'png'})">{{ $t("command.export_png") }}</sui-dropdown-item>
        </sui-dropdown-menu>
      </sui-dropdown>
    </sui-popup>
  </div>
</template>

<script>

import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import UtilService from "../services/utils";

export default {
  name: "ExportData",
  mixins: [UtilService],
  props: [
    "visible",
    "pdf",
    "transparent",
    "data",
    "filename",
    "pdfElementContainerId",
    "pdfElementHeaderClass",
    "type"
  ],
  data: function() {
    return {
      isVisible: this.visible || true,
      isPdf: this.pdf || true,
      isPng: this.png || true,
      parsedName: this.parseName(this.filename || "report")
    };
  },
  methods: {

    reversePhonebookSearchCsvName(element) {
      const csvName = this.$options.filters.reversePhonebookLookup (
        element,
        "name",
        this.$root
      );
      element = csvName
      if (element === "-"){
        element = element.replace(/-/g, ' ')
      }
      return element;
    },

    reversePhonebookSearchCsvCompany(item) {
      const csvCompany = this.$options.filters.reversePhonebookLookup (
        item,
        "company",
        this.$root
      );
      item = csvCompany
      if (item === "-"){
        item = item.replace(/-/g, ' ')
      }
      return item;

    },


    exportToCSV () {
      let data = this._.cloneDeep(this.data)
      if(this.$root._route.path == "/queue/data/caller" || this.$root._route.path == "/queue/data/call") {
        let nameCompany = data.slice(1).map(item => {
          if (item[2]) {
            item[2] = this.reversePhonebookSearchCsvName(item[2]);
          }
          if (item[3]) {
            item[3] = this.reversePhonebookSearchCsvCompany(item[3]);
          }
          console.log(nameCompany);
          return item;
        });
      }

      // if 'src£phoneNumber' / 'dst£phoneNumber' columns are present, generate 'srcDevice' / 'dstDevice' columns
      data = this.checkDeviceColumns(data);
      // translate col labels
      for (let key in data[0]) data[0][key] = this.$t(this.parseColHeader(data[0][key]))

      // rrd charts may contain queue labels such as "7000£queue", remove the format part ("£queue")
      if (this.type == "line") {
        for (let row of data.slice(1)) {
          const format = row[0].split("£")[1];

          if (format) {
            row[0] = row[0].split("£")[0];
          }
        }
      }

      // convert data obj to csv
      let blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' }),
          link = document.createElement("a"),
          url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${this.parsedName}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      // download csv
      link.click();
      document.body.removeChild(link)
      data = null
    },
    async exportToPDFPNG (elementTag, options = {}) {
      if (!this.pdfElementContainerId) return
      // get the element height/width
      let element = document.querySelector(`${this.pdfElementContainerId} ${elementTag}`),
          header = document.querySelector(`${this.pdfElementContainerId} ${this.pdfElementHeaderClass}`),
          elementHeight = element.offsetHeight,
          elementWidth = element.offsetWidth,
          orizontalMargins = options.margin || 100,
          marginTop = options.top || 70,
          marginBottom = options.bottom || 20
      // image caption canvas
      let captionCanvas
      // create partial canvas
      let pdfCanvas = document.createElement("canvas")
      pdfCanvas.setAttribute("id", "canvaspdf")
      pdfCanvas.setAttribute("width", elementWidth + (orizontalMargins * 2))
      pdfCanvas.setAttribute("height", elementHeight + marginTop)
      // keep track canvas position
      let pdfctx = pdfCanvas.getContext('2d'),
          pdfctxX = orizontalMargins,
          pdfctxY = marginTop
      // create new pdf and add our new canvas as an image
      let pdf = new jsPDF({
        orientation: 'l',
        unit: 'pt',
        format: [(elementWidth + orizontalMargins * 2) * 0.75 , (elementHeight + marginTop + marginBottom) * 0.75],
        compress:true
      })
      // retrieve caption canvas
      await html2canvas(header, {backgroundColor: null} ).then(function(canvas) {
        captionCanvas = canvas
      })
      // add header html header to pdf
      pdf.addImage(captionCanvas, 'PNG', (((elementWidth + orizontalMargins * 2) - header.offsetWidth) * 0.75) / 2, 20)
      // draw imange into the new canvas
      pdfctx.drawImage(element, pdfctxX, pdfctxY, elementWidth, elementHeight)
      // export data
      if (options.file_type == "png") {
        let link = document.createElement("a")
        pdfctx.drawImage(captionCanvas, ((elementWidth + orizontalMargins * 2) - header.offsetWidth) / 2, 20)
        let  url = pdfCanvas.toDataURL("image/png;base64")
        link.setAttribute("href", url)
        link.setAttribute("download", `${this.parsedName}.png`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        // download png
        link.click();
        document.body.removeChild(link)
      } else if (options.file_type == "pdf") {
        // add canvas to pdf
        pdf.addImage(pdfCanvas, 'PNG', 0, 0)
        // download the pdf
        pdf.save(`${this.parsedName}.pdf`);
      }
    },
    parseName (filename) {
      return filename.toLowerCase().replace(/[\s.]+/g,'_')
    },
    parseColHeader (header) {
      let parsedHeader = this.parseTableChartHeader(header)
      let resHeader = parsedHeader.bottomHeaderName || parsedHeader.middleHeaderName || parsedHeader.topHeaderName
      return resHeader
    },
    checkDeviceColumns (data) {
      const columns = data[0];
      const srcPos = columns.indexOf("src£phoneNumber");
      const dstPos = columns.indexOf("dst£phoneNumber");

      if (srcPos > -1 && dstPos > -1) {
        // generate 'srcDevice' and 'dstDevice' columns
        // add new columns near src/dst (add right-most column first)

        const rows = data.slice(1);

        if (this.$root._route.path == "/cdr/pbx/inbound" || this.$root._route.path == "/cdr/personal/inbound") {
          if (srcPos < dstPos) {
            columns.splice(dstPos + 1, 0, "dstDevice");
            columns.splice(dstPos + 2, 0, "dstName");
            columns.splice(srcPos + 1, 0, "srcName");
            columns.splice(srcPos + 2, 0, "srcCompany");
            
          } else {
            columns.splice(srcPos + 1, 0, "srcName");
            columns.splice(srcPos + 2, 0, "srcCompany");
            columns.splice(dstPos + 1, 0, "dstDevice");
            columns.splice(dstPos + 2, 0, "dstName");
          }

          for (const row of rows) {
            const srcElem = row[srcPos];
            const dstElem = row[dstPos];
            let srcName = this.reversePhonebookSearchCsvName(srcElem);
            let srcCompany = this.reversePhonebookSearchCsvCompany(srcElem);
            let dstName = this.reversePhonebookSearchCsvName(dstElem);
            let dstDevice = "";

          if (this.$root.devices[dstElem]) {
            dstDevice = this.$root.devices[dstElem].type;
          }

            if (srcPos < dstPos) {
              row.splice(dstPos + 1, 0, dstDevice);
              row.splice(dstPos + 2, 0, dstName);
              row.splice(srcPos + 1, 0, srcName);
              row.splice(srcPos + 2, 0, srcCompany);
              
            } else {
              row.splice(srcPos + 1, 0, srcName);
              row.splice(srcPos + 2, 0, srcCompany);
              row.splice(dstPos + 1, 0, dstDevice);
              row.splice(dstPos + 2, 0, dstName);
            }

          }
        }

        if (this.$root._route.path == "/cdr/pbx/outbound" || this.$root._route.path == "/cdr/personal/outbound") {

          if (srcPos < dstPos) {
            columns.splice(dstPos + 1, 0, "dstName");
            columns.splice(dstPos + 2, 0, "dstCompany");
            columns.splice(srcPos + 1, 0, "srcDevice");
            columns.splice(srcPos + 2, 0, "srcName");
            
          } else {
            columns.splice(srcPos + 1, 0, "srcDevice");
            columns.splice(srcPos + 2, 0, "srcName");
            columns.splice(dstPos + 1, 0, "dstName");
            columns.splice(dstPos + 2, 0, "dstCompany");
          }

          for (const row of rows) {
            const srcElem = row[srcPos];
            const dstElem = row[dstPos];
            let srcName = this.reversePhonebookSearchCsvName(srcElem);
            let dstName = this.reversePhonebookSearchCsvName(dstElem);
            let dstCompany = this.reversePhonebookSearchCsvName(dstElem);
            let srcDevice = "";

            if (this.$root.devices[srcElem]) {
              srcDevice = this.$root.devices[srcElem].type;
            }

            if (srcPos < dstPos) {
              row.splice(dstPos + 1, 0, dstName);
              row.splice(dstPos + 2, 0, dstName);
              row.splice(srcPos + 1, 0, srcDevice);
              row.splice(srcPos + 2, 0, srcName);
              
            } else {
              row.splice(srcPos + 1, 0, srcDevice);
              row.splice(srcPos + 2, 0, srcName);
              row.splice(dstPos + 1, 0, dstCompany);
              row.splice(dstPos + 2, 0, dstName);
            }

          }
        }

        if (this.$root._route.path == "/cdr/pbx/local" || this.$root._route.path == "/cdr/personal/local") {

          if (srcPos < dstPos) {
            columns.splice(dstPos + 1, 0, "dstDevice");
            columns.splice(dstPos + 2, 0, "dstName");
            columns.splice(srcPos + 1, 0, "srcDevice");
            columns.splice(srcPos + 2, 0, "srcName");
          } else {
            columns.splice(srcPos + 1, 0, "srcDevice");
            columns.splice(srcPos + 2, 0, "srcName");
            columns.splice(dstPos + 1, 0, "dstDevice");
            columns.splice(dstPos + 2, 0, "dstName");
          }

          for (const row of rows) {
            const srcElem = row[srcPos];
            const dstElem = row[dstPos];
            let srcName = this.reversePhonebookSearchCsvName(srcElem);
            let dstName = this.reversePhonebookSearchCsvName(dstElem);
            let srcDevice = "";
            let dstDevice = "";

            if (this.$root.devices[srcElem]) {
              srcDevice = this.$root.devices[srcElem].type;
            }

            if (this.$root.devices[dstElem]) {
              dstDevice = this.$root.devices[dstElem].type;
            }

            if (srcPos < dstPos) {
              row.splice(dstPos + 1, 0, dstDevice);
              row.splice(dstPos + 2, 0, dstName);
              row.splice(srcPos + 1, 0, srcDevice);
              row.splice(srcPos + 2, 0, srcName);
            } else {
              row.splice(srcPos + 2, 0, srcName);
              row.splice(dstPos + 1, 0, dstDevice);
              row.splice(srcPos + 1, 0, srcDevice);
              row.splice(dstPos + 2, 0, dstName);
            }

          }
        }
      }
      return data;
    },
  },
  watch: {
    "filename": function () {
      this.parsedName = this.parseName(this.filename || "report")
    }
  },
}

</script>

<style lang="scss" scoped>
.transparent {
  padding: 2px !important;
  background: none !important;
  margin: 0px 7px !important;
  .menu {
    left: -9px !important;
  }
}
.custom-btn {
  padding: .78571429em .78571429em .78571429em !important;
  margin: 0 4px 0 0 !important;
  margin: 0px !important;
}
</style>