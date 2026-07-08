package store

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEscapeLikeValue_SpecialCharacters(t *testing.T) {
	assert.Equal(t, `Sales\%\_\\West`, escapeLikeValue(`Sales%_\West`))
}

func TestGetSharedGroupPatterns_EscapesLikeWildcards(t *testing.T) {
	patterns := getSharedGroupPatterns(`Sales%_\West`)

	assert.Equal(t, []string{
		`group:Sales%_\West`,
		`group:Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West`,
	}, patterns)
}

func TestBuildVisibleCTIWhere_MacroOnlyStillEscapesGroupPatterns(t *testing.T) {
	whereClause, args := buildVisibleCTIWhere("alice", []string{`Sales%_\West`}, true)

	assert.Contains(t, whereClause, `owner_id = ?`)
	assert.Contains(t, whereClause, `type LIKE ? ESCAPE '\\'`)
	assert.Equal(t, []any{
		"alice",
		`group:Sales%_\West`,
		`group:Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West`,
	}, args)
}

func TestBuildLegacySearchClauses_EscapesLikeWildcards(t *testing.T) {
	ctiArgs, centralizedArgs, ctiClause, centralizedClause := buildLegacySearchClauses("", `Sales%_\West`)

	assert.Contains(t, ctiClause, `LIKE ? ESCAPE '\\'`)
	assert.Contains(t, centralizedClause, `LIKE ? ESCAPE '\\'`)
	assert.Equal(t, []any{
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
	}, ctiArgs)
	assert.Equal(t, []any{
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
		`%Sales\%\_\\West%`,
	}, centralizedArgs)
}

func TestBuildLegacyVisibilityClauses_CentralizedUsesItsOwnTaxonomy(t *testing.T) {
	t.Run("all keeps centralized rows visible", func(t *testing.T) {
		ctiClause, ctiArgs, centralizedClause, centralizedArgs := buildLegacyVisibilityClauses("all")

		assert.Equal(t, "1 = 1", ctiClause)
		assert.Nil(t, ctiArgs)
		assert.Equal(t, "1 = 1", centralizedClause)
		assert.Nil(t, centralizedArgs)
	})

	t.Run("public still includes centralized rows", func(t *testing.T) {
		ctiClause, ctiArgs, centralizedClause, centralizedArgs := buildLegacyVisibilityClauses("public")

		assert.Equal(t, "type = ?", ctiClause)
		assert.Equal(t, []any{"public"}, ctiArgs)
		assert.Equal(t, "1 = 1", centralizedClause)
		assert.Nil(t, centralizedArgs)
	})

	t.Run("private and group exclude centralized rows", func(t *testing.T) {
		_, _, centralizedPrivateClause, centralizedPrivateArgs := buildLegacyVisibilityClauses("private")
		_, _, centralizedGroupClause, centralizedGroupArgs := buildLegacyVisibilityClauses("group")

		assert.Equal(t, "1 = 0", centralizedPrivateClause)
		assert.Nil(t, centralizedPrivateArgs)
		assert.Equal(t, "1 = 0", centralizedGroupClause)
		assert.Nil(t, centralizedGroupArgs)
	})
}
