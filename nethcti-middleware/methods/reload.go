package methods

import (
	"fmt"
	"net/http"

	"github.com/fatih/structs"
	"github.com/gin-gonic/gin"
	"github.com/nethesis/nethcti-middleware/logs"
	"github.com/nethesis/nethcti-middleware/models"
	"github.com/nethesis/nethcti-middleware/store"
)

// AdminReloadProfiles reloads profiles and users globally via super admin API endpoint
func AdminReloadProfiles(c *gin.Context) {
	// Reload profiles and users from configuration files
	stats, err := store.ReloadProfiles()
	if err != nil {
		logs.Log("[ERROR] Failed to reload profiles via super admin: " + err.Error())
		c.JSON(http.StatusInternalServerError, structs.Map(models.StatusInternalServerError{
			Code:    http.StatusInternalServerError,
			Message: "failed to reload profiles",
			Data:    err.Error(),
		}))
		return
	}

	logs.Log(fmt.Sprintf("[INFO] Reloaded users from /etc/nethcti/users.json: users=%d", stats.UsersLoaded))
	logs.Log(fmt.Sprintf("[INFO] Reloaded profiles from /etc/nethcti/profiles.json: profiles=%d", stats.ProfilesLoaded))

	// Return success response
	c.JSON(http.StatusOK, structs.Map(models.StatusOK{
		Code:    200,
		Message: "profiles reloaded successfully",
		Data:    gin.H{},
	}))
}
