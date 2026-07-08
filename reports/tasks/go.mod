module github.com/nethesis/nethvoice-report/tasks

go 1.14

require (
	github.com/fatih/color v1.9.0
	github.com/nethesis/nethvoice-report/api v0.0.0
	github.com/pkg/errors v0.9.1
	github.com/spf13/cobra v1.0.0
	github.com/spf13/viper v1.7.1
	github.com/thoas/go-funk v0.7.0
)

replace github.com/nethesis/nethvoice-report/api => ../api
