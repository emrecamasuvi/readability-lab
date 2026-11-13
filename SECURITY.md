# Security

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/emrecamasuvi/readability-lab/security/advisories/new), rather than in public issues.

Areas of particular interest:
- injection through imported profiles, share codes or recipes (values are schema-restricted and re-validated before CSS generation);
- extension permission scope;
- sanitisation of reader-view and workbench content;
- anything that could send reading content off the device.
