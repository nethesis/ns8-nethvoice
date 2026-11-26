# Phone Island screen sharing

CTI installs a local prerelease of Phone Island so the locked build works before the upstream npm release. The package uses Phone Island v1.1.10 with the accompanying source patch.

To rebuild it, check out [Phone Island v1.1.10](https://github.com/nethesis/phone-island/tree/v1.1.10), then run these commands from the Phone Island checkout. Use the absolute path to this directory for `vendor_dir`.

```sh
git apply "$vendor_dir/phone-island-screen-sharing.patch"
npm ci
node scripts/test-screen-sharing.cjs
npm run build
npm pack --pack-destination "$vendor_dir"
```

When the change is published to npm, update CTI's dependency and lockfile to the npm release and remove the local tarball and its Dockerfile copy step.
