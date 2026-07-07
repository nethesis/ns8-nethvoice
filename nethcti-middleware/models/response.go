package models

type StatusOK struct {
	Code    int         `json:"code" example:"200" structs:"code"`
	Message string      `json:"message" example:"Success" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusBadRequest struct {
	Code    int         `json:"code" example:"400" structs:"code"`
	Message string      `json:"message" example:"Bad request" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusUnauthorized struct {
	Code    int         `json:"code" example:"401" structs:"code"`
	Message string      `json:"message" example:"Unauthorized" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusForbidden struct {
	Code    int         `json:"code" example:"403" structs:"code"`
	Message string      `json:"message" example:"Forbidden" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusNotFound struct {
	Code    int         `json:"code" example:"404" structs:"code"`
	Message string      `json:"message" example:"Not found" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusServiceUnavailable struct {
	Code    int         `json:"code" example:"503" structs:"code"`
	Message string      `json:"message" example:"Service unavailable" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}

type StatusInternalServerError struct {
	Code    int         `json:"code" example:"500" structs:"code"`
	Message string      `json:"message" example:"Internal server error" structs:"message"`
	Data    interface{} `json:"data" structs:"data"`
}
