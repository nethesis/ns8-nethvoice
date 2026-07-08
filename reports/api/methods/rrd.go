package methods

import (
	"fmt"
	"math"
	"os"
	"strings"
	"time"

	"github.com/nethesis/nethvoice-report/api/configuration"
	"github.com/nethesis/nethvoice-report/api/models"
	"github.com/nethesis/nethvoice-report/api/utils"
	"github.com/pkg/errors"
	"github.com/ziutek/rrd"
)

func QueryRrd(rrdFilePath string, filter models.Filter, start time.Time, end time.Time) (string, error) {
	hostname, errHostname := os.Hostname()
	if errHostname != nil {
		return "", errors.Wrap(errHostname, "error retrieving hostname")
	}

	rrdRootPath := configuration.Config.RrdPath
	var dbFile string
	var rrdData [][]interface{}

	// replace parameters in rrdFilePath (if any)

	if strings.Contains(rrdFilePath, "?QUEUE") {

		// execute RRD query for every queue in filter

		if len(filter.Queues) == 0 {
			return "[[\"!message\"], [\"queues field is required\"]]", nil
		}

		for i, queue := range filter.Queues {
			rrdFilePathReplaced := strings.ReplaceAll(rrdFilePath, "?QUEUE", queue)

			dbFile := fmt.Sprintf("%s/%s/%s", rrdRootPath, hostname, rrdFilePathReplaced)
			results, errRrd := fetchRrd(dbFile, start, end, queue+"£queue")
			if errRrd != nil {
				// log error and continue
				utils.LogError(errRrd)
			}

			if i > 0 && len(results) > 0 {
				// remove columns row before appending
				results = results[1:]
			}
			rrdData = append(rrdData, results...)
		}
	} else {

		// no parameters in query file path

		var errRrd error
		dbFile = fmt.Sprintf("%s/%s/%s", rrdRootPath, hostname, rrdFilePath)

		rrdData, errRrd = fetchRrd(dbFile, start, end, "dataset")
		if errRrd != nil {
			return "", errRrd
		}
	}

	data, errParse := utils.ParseRrdResults(rrdData)
	if errParse != nil {
		return "", errParse
	}
	return data, nil
}

func fetchRrd(dbFile string, start time.Time, end time.Time, label string) ([][]interface{}, error) {
	var data [][]interface{}

	// fetch RRD data
	fetchRes, err := rrd.Fetch(dbFile, "MAX", start, end, time.Second)
	if err != nil {
		return nil, errors.Wrap(err, "error fetching RRD data")
	}
	defer fetchRes.FreeValues()

	// build columns
	var columns []string
	columns = append(columns, "label")
	columns = append(columns, "timestamp")

	for _, dsName := range fetchRes.DsNames {
		columns = append(columns, dsName)
	}

	var tmp []interface{}
	for _, c := range columns {
		tmp = append(tmp, c)
	}
	data = append(data, tmp)

	// build data records
	row := 0
	for ti := fetchRes.Start.Add(fetchRes.Step); ti.Before(end) || ti.Equal(end); ti = ti.Add(fetchRes.Step) {
		var record []interface{}
		record = append(record, label)
		timestamp := int(ti.Unix())
		record = append(record, utils.EpochToHumanDate(timestamp))

		for i := 0; i < len(fetchRes.DsNames); i++ {
			v := fetchRes.ValueAt(i, row)
			v = math.Round(v)

			// set negative values (missing values) to zero
			if v < 0 {
				v = 0
			}
			record = append(record, v)
		}
		row++
		data = append(data, record)
	}
	return data, nil
}
