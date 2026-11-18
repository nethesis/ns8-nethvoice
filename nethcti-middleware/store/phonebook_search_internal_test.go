package store

import (
	"strings"
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
	assert.Len(t, ctiArgs, 12)
	assert.Len(t, centralizedArgs, 8)
	for _, arg := range append(append([]any{}, ctiArgs...), centralizedArgs...) {
		assert.Equal(t, `%Sales\%\_\\West%`, arg)
	}
}

func TestBuildLegacySearchClauses_SingleTokenKeepsFlatOrGroup(t *testing.T) {
	ctiArgs, centralizedArgs, ctiClause, centralizedClause := buildLegacySearchClauses("", "rossi")

	assert.NotContains(t, ctiClause, " AND ")
	assert.NotContains(t, centralizedClause, " AND ")
	assert.Len(t, ctiArgs, 12)
	assert.Len(t, centralizedArgs, 8)
}

func TestBuildLegacySearchClauses_TokenizesTermOnWhitespace(t *testing.T) {
	ctiArgs, centralizedArgs, ctiClause, centralizedClause := buildLegacySearchClauses("", "  Rossi   Mario ")

	assert.Equal(t, 1, strings.Count(ctiClause, ") AND ("))
	assert.Equal(t, 1, strings.Count(centralizedClause, ") AND ("))
	assert.Equal(t, []any{
		"%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%",
		"%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%", "%Rossi%",
		"%Mario%", "%Mario%", "%Mario%", "%Mario%", "%Mario%", "%Mario%",
		"%Mario%", "%Mario%", "%Mario%", "%Mario%", "%Mario%", "%Mario%",
	}, ctiArgs)
	assert.Len(t, centralizedArgs, 16)
}

func TestBuildLegacySearchClauses_SearchesSplitNameColumns(t *testing.T) {
	t.Run("default view searches name, company and the split columns", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("", "rossi")

		for _, clause := range []string{ctiClause, centralizedClause} {
			assert.Contains(t, clause, `name LIKE ?`)
			assert.Contains(t, clause, `company LIKE ?`)
			assert.Contains(t, clause, `firstname LIKE ?`)
			assert.Contains(t, clause, `lastname LIKE ?`)
		}
	})

	t.Run("person view searches the split columns but not company", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("person", "rossi")

		for _, clause := range []string{ctiClause, centralizedClause} {
			assert.Contains(t, clause, `firstname LIKE ?`)
			assert.Contains(t, clause, `lastname LIKE ?`)
			assert.NotContains(t, clause, `company LIKE ?`)
		}
	})

	t.Run("company view keeps matching company only", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("company", "acme")

		for _, clause := range []string{ctiClause, centralizedClause} {
			assert.Contains(t, clause, `company LIKE ?`)
			assert.NotContains(t, clause, `firstname LIKE ?`)
			assert.NotContains(t, clause, `lastname LIKE ?`)
			assert.NotContains(t, clause, `name LIKE ?`)
		}
	})
}

func TestLegacySearchTokens(t *testing.T) {
	assert.Equal(t, []string{""}, legacySearchTokens(""))
	assert.Equal(t, []string{""}, legacySearchTokens("   \t "))

	assert.Equal(t, []string{"Mario", "Rossi"}, legacySearchTokens(" Mario  Rossi "))
	assert.Equal(t, []string{"Rossi"}, legacySearchTokens("Rossi rossi ROSSI"))

	capped := legacySearchTokens("a b c d e f g h")
	assert.Len(t, capped, legacySearchTokenLimit)
	assert.Equal(t, []string{"a", "b", "c", "d", "e", "f"}, capped)
}

func TestLegacyFlatOrderByClause(t *testing.T) {
	// The empty/unknown sort MUST keep the legacy ordering: existing frontends
	// (nethvoice-cti, phone-island) do not send a sort param yet, so changing
	assert.Equal(t, "ORDER BY company ASC, name ASC", legacyFlatOrderByClause(""))
	assert.Equal(t, "ORDER BY company ASC, name ASC", legacyFlatOrderByClause("bogus"))

	assert.Equal(t,
		"ORDER BY (firstname IS NULL OR firstname = '') ASC, "+
			"COALESCE(NULLIF(firstname, ''), "+flatDisplayKey+") ASC",
		legacyFlatOrderByClause("firstname"))

	lastnameClause := "ORDER BY (lastname IS NULL OR lastname = '') ASC, " +
		"COALESCE(NULLIF(lastname, ''), " + flatDisplayKey + ") ASC"
	assert.Equal(t, lastnameClause, legacyFlatOrderByClause("lastname"))
	assert.Equal(t, lastnameClause, legacyFlatOrderByClause("surname"))
	assert.Equal(t, lastnameClause, legacyFlatOrderByClause("LASTNAME"))

	assert.Equal(t,
		"ORDER BY COALESCE(NULLIF(company, ''), "+flatDisplayKey+") ASC",
		legacyFlatOrderByClause("company"))

	assert.Equal(t, "ORDER BY "+flatDisplayKey+" ASC", legacyFlatOrderByClause("displayname"))
	assert.Equal(t, "ORDER BY "+flatDisplayKey+" ASC", legacyFlatOrderByClause("name"))
}

func TestLegacyListOrderByClause(t *testing.T) {
	assert.Equal(t, "ORDER BY sort_name ASC", legacyListOrderByClause(""))
	assert.Equal(t, "ORDER BY sort_name ASC", legacyListOrderByClause("bogus"))
	assert.Equal(t, "ORDER BY sort_name ASC", legacyListOrderByClause("displayname"))
	assert.Equal(t, "ORDER BY sort_name ASC", legacyListOrderByClause("name"))

	assert.Equal(t,
		"ORDER BY (firstname IS NULL OR firstname = '') ASC, "+
			"COALESCE(NULLIF(firstname, ''), sort_name) ASC",
		legacyListOrderByClause("firstname"))

	lastnameClause := "ORDER BY (lastname IS NULL OR lastname = '') ASC, " +
		"COALESCE(NULLIF(lastname, ''), sort_name) ASC"
	assert.Equal(t, lastnameClause, legacyListOrderByClause("lastname"))
	assert.Equal(t, lastnameClause, legacyListOrderByClause("surname"))

	assert.Equal(t, "ORDER BY company ASC, sort_name ASC", legacyListOrderByClause("company"))
}

func TestBuildLegacySearchClauses_ViewGuards(t *testing.T) {
	const personGuard = "name IS NOT NULL AND name != '' AND name != '-'"
	const companyGuard = "company IS NOT NULL AND company != '' AND company != '-'"

	t.Run("person view guards out company rows", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("person", "acme")

		assert.Contains(t, ctiClause, personGuard+" AND (")
		assert.Contains(t, centralizedClause, personGuard+" AND (")
		assert.NotContains(t, ctiClause, companyGuard)
	})

	t.Run("company view guards out person rows without company", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("company", "acme")

		assert.Contains(t, ctiClause, companyGuard+" AND (")
		assert.Contains(t, centralizedClause, companyGuard+" AND (")
		assert.NotContains(t, ctiClause, personGuard)
	})

	t.Run("default view applies no guard", func(t *testing.T) {
		_, _, ctiClause, centralizedClause := buildLegacySearchClauses("", "acme")

		assert.NotContains(t, ctiClause, personGuard)
		assert.NotContains(t, ctiClause, companyGuard)
		assert.NotContains(t, centralizedClause, personGuard)
		assert.NotContains(t, centralizedClause, companyGuard)
	})
}

func TestBuildVisibleCentralizedWhere_NoGroupsOnlyNonGroupScoped(t *testing.T) {
	clause, args := buildVisibleCentralizedWhere(nil)

	assert.Equal(t, `access NOT LIKE ? ESCAPE '\\'`, clause)
	assert.Equal(t, []any{"group:%"}, args)
}

func TestBuildVisibleCentralizedWhere_WithGroupsAddsMembershipPatterns(t *testing.T) {
	clause, args := buildVisibleCentralizedWhere([]string{`Sales%_\West`})

	assert.Contains(t, clause, `access NOT LIKE ? ESCAPE '\\'`)
	assert.Contains(t, clause, `access = ? OR access LIKE ? ESCAPE '\\'`)
	assert.Equal(t, []any{
		"group:%",
		`group:Sales%_\West`,
		`group:Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West,%`,
		`group:%,Sales\%\_\\West`,
	}, args)
}

func TestBuildLegacyVisibilityClauses_CentralizedUsesItsOwnTaxonomy(t *testing.T) {
	t.Run("all keeps centralized rows visible", func(t *testing.T) {
		ctiClause, ctiArgs, centralizedClause, centralizedArgs := buildLegacyVisibilityClauses("all")

		assert.Equal(t, "1 = 1", ctiClause)
		assert.Nil(t, ctiArgs)
		assert.Equal(t, "1 = 1", centralizedClause)
		assert.Nil(t, centralizedArgs)
	})

	t.Run("public includes non-group centralized rows, excludes group-scoped", func(t *testing.T) {
		ctiClause, ctiArgs, centralizedClause, centralizedArgs := buildLegacyVisibilityClauses("public")

		assert.Equal(t, "type = ?", ctiClause)
		assert.Equal(t, []any{"public"}, ctiArgs)
		assert.Equal(t, "access NOT LIKE ?", centralizedClause)
		assert.Equal(t, []any{"group:%"}, centralizedArgs)
	})

	t.Run("private excludes centralized rows, group gates them by scope", func(t *testing.T) {
		_, _, centralizedPrivateClause, centralizedPrivateArgs := buildLegacyVisibilityClauses("private")
		_, _, centralizedGroupClause, centralizedGroupArgs := buildLegacyVisibilityClauses("group")

		// No private concept in the centralized phonebook.
		assert.Equal(t, "1 = 0", centralizedPrivateClause)
		assert.Nil(t, centralizedPrivateArgs)
		// Group view keeps only group-scoped centralized rows via the access column
		// (membership is enforced separately by buildVisibleCentralizedWhere).
		assert.Equal(t, "access LIKE ?", centralizedGroupClause)
		assert.Equal(t, []any{"group:%"}, centralizedGroupArgs)
	})
}
