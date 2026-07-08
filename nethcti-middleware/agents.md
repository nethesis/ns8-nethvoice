# AGENTS.md

This document provides instructions for AI coding agents to interact with the `nethcti-middleware` codebase.

## About the Project

This project is a middleware service written in Go. It provides a RESTful API and is containerized using Podman.
Designed to run inside NethServer 8.

## Development Environment

The development environment is based on Go and Podman.

1.  **Prerequisites**:
    *   Go (version 1.24 or later)
    *   Podman
    *   `oath-toolkit-oathtool`

2.  **Setup**:
    *   Clone the repository.
    *   Install Go dependencies:
        ```bash
        go mod download
        ```

3.  **Building**:
    *   To build the application binary:
        ```bash
        go build -o whale
        ```
    *   To build the container image:
        ```bash
        podman build -t nethcti-middleware .
        ```

## Code style

- Always apply go fmt formatting before committing code:
    ```bash
    go fmt ./...
    ```

## Code conventions

- Log errors using the logs package.
- Use context.Context for request-scoped values and deadlines.
- When logging, first add the priority level, then the component, e.g.:
  ```go
    logs.Log("[INFO][PROXY] FreePBX API call for user: " + authorizationUser)
  ```
- Valid logging levels are: DEBUG, INFO, WARNING, ERROR, CRITICAL.

## Testing Instructions

The project includes a dedicated test suite covering its core functionality.

*   When adding new features or fixing bugs, you **must** also add corresponding tests.
*   Use Go's standard testing library.
*   Place test files alongside the source files using the `_test.go` suffix (e.g., `feature_test.go`).
*   Run tests using the following command:
    ```bash
    go test ./...
    ```

### Testing steps

1. ALWAYS start mariadb container before starting tests
   ```bash
    podman run -d --rm --name mariadb-nethcti -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=nethcti3 \
    -p 3306:3306 docker.io/library/mariadb:10.8.2
    ```
2. Run tests, but make sure that mariadb-nethcti container is running
    ```bash
    go test ./...
    go test ./... -v -cover
    ```
3. Generate coverage report
    ```bash
    go test ./... -coverprofile=coverage.out
    go tool cover -html=coverage.out -o coverage.html
    ```
4. Stop the test mariadb container
    ```bash
    podman stop mariadb-test
    ```

## Definition of Done

A task or feature is considered "done" when it meets all the following criteria:

1.  **Code is complete**: The feature is fully implemented according to the requirements.
2.  **Builds successfully**: The `go build` command completes without errors.
3.  **Tests are included**: New, relevant unit tests have been added to cover the new code.
4.  **All tests pass**: The `go test ./...` command runs successfully with no failing tests.
5.  **Linting is clean**: The code adheres to standard Go formatting and linting rules. Run `go fmt ./...` before committing.
6.  **Documentation is updated**: Any relevant documentation, including the OpenAPI spec  `doc/openapi.yaml`, has been updated.

## Release Workflow

This section describes the complete workflow for making changes to the middleware and deploying them to production.

### 1. Create Issue

Create an issue on the [NethServer/dev](https://github.com/NethServer/dev/issues) repository to document the bug or feature request.

```bash
gh issue create --repo NethServer/dev --title "Title" --body "Description"
```

**Example:**
```bash
gh issue create --repo NethServer/dev --title "nethcti-middleware: Missing /user/presence API in FreePBX APIs whitelist" --body "..."
```

### 2. Create Feature Branch and Implement Fix

```bash
# Create a new branch from main
git checkout -b fix-description

# Make your changes to the code
# ...

# Commit changes with a descriptive message
git add <files>
git commit -m "fix: short description of the fix"
```

**Important:**
- Use conventional commit messages: `fix:`, `feat:`, `chore:`, etc.
- Keep commits focused and atomic
- Write clear, concise commit messages

### 3. Push Branch and Create Pull Request

```bash
# Push the branch to remote
git push -u origin fix-description

# Create a pull request with detailed description
gh pr create --title "fix: short description" --body "$(cat <<'EOF'
## Summary

Brief summary of the changes

## Description

Detailed description of what was changed and why

## Related Issue

Fixes NethServer/dev#XXXX
EOF
)"
```

**Important:**
- Include "Fixes NethServer/dev#XXXX" in the PR description to automatically link and close the issue
- Provide a clear summary and detailed description
- Explain the context and the solution implemented

### 4. Merge Pull Request

Once the PR is approved and all checks pass:

```bash
# Merge the PR using squash merge
gh pr merge <PR_NUMBER> --squash
```

**Why squash merge:**
- Keeps the main branch history clean
- Combines all commits from the feature branch into a single commit
- Makes it easier to track changes and revert if needed

### 5. Tag New Version

After merging, create a new version tag:

```bash
# Switch to main and pull latest changes
git checkout main
git pull

# Check the latest tag
git tag --sort=-v:refname | head -5

# Create a new tag (increment version appropriately)
git tag vX.Y.Z -m "Release vX.Y.Z: brief description"

# Push the tag to remote
git push origin vX.Y.Z
```

**Version numbering:**
- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.Y.0): New features, backward compatible
- **PATCH** (0.0.Z): Bug fixes, backward compatible

**Example:**
```bash
git tag v0.4.4 -m "Release v0.4.4: fix /user/presence API authentication"
git push origin v0.4.4
```

### 6. Update ns8-nethvoice Repository

After releasing a new middleware version, update the [ns8-nethvoice](https://github.com/nethesis/ns8-nethvoice) repository to use the new version:

```bash
# Navigate to ns8-nethvoice repository
cd /path/to/ns8-nethvoice

# Create a new branch
git checkout -b update-middleware-vX.Y.Z

# Update build-images.sh with the new middleware version
# Edit line containing: container=$(buildah from ghcr.io/nethesis/nethcti-middleware:vX.Y.Z)

# Commit and push changes
git add build-images.sh
git commit -m "chore: update nethcti-middleware to vX.Y.Z"
git push -u origin update-middleware-vX.Y.Z

# Create pull request
gh pr create --title "chore: update nethcti-middleware to vX.Y.Z" --body "$(cat <<'EOF'
## Summary

Update nethcti-middleware from vA.B.C to vX.Y.Z

## Description

This PR updates the nethcti-middleware container image to version vX.Y.Z, which includes:
- Brief description of what changed

## Related Issue

NethServer/dev#XXXX

## Changes

- Updated `build-images.sh` to use `ghcr.io/nethesis/nethcti-middleware:vX.Y.Z`
EOF
)"
```

**Important:**
- Always reference the original issue from NethServer/dev
- If the main branch has moved forward, rebase your branch before merging:
  ```bash
  git checkout main
  git pull
  git checkout update-middleware-vX.Y.Z
  git rebase main
  # Resolve any conflicts if they occur
  git push --force-with-lease origin update-middleware-vX.Y.Z
  ```

### Complete Workflow Example

Here's a complete example of the workflow:

```bash
# 1. Create issue
gh issue create --repo NethServer/dev --title "middleware: API authentication issue" --body "..."
# Issue created: NethServer/dev#7772

# 2. Create branch and implement fix
git checkout -b fix-user-presence-api
# ... make changes ...
git add configuration/configuration.go
git commit -m "fix: add /user/presence to FreePBX APIs whitelist"
git push -u origin fix-user-presence-api

# 3. Create PR
gh pr create --title "fix: add /user/presence to FreePBX APIs whitelist" --body "...Fixes NethServer/dev#7772..."
# PR created: #15

# 4. Merge PR (after approval)
gh pr merge 15 --squash

# 5. Tag new version
git checkout main
git pull
git tag v0.4.4 -m "Release v0.4.4: fix /user/presence API authentication"
git push origin v0.4.4

# 6. Update ns8-nethvoice
cd /path/to/ns8-nethvoice
git checkout main
git pull
git checkout -b update-middleware-v0.4.4
# Edit build-images.sh to update version
git add build-images.sh
git commit -m "chore: update nethcti-middleware to v0.4.4"
git push -u origin update-middleware-v0.4.4
gh pr create --title "chore: update nethcti-middleware to v0.4.4" --body "...NethServer/dev#7772..."
```
