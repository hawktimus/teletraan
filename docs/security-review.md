# Security setup for the Teletraan computer

Do these once on each computer that runs Teletraan I. They are setup steps, not a report. Findings from reviews are kept by
the coaches and are not published.

1. Choose your own control page PIN. Put `CONTROL_PIN='<4 to 12 digits>'` in `/opt/teletraan/local.env` by hand over SSH
   (the line is explained in `computer/local.example.env`), then restart the services. Tell only the coaches.
2. Limit who can reach ports 3229 (control page, Studio, copy of the dashboard) and 3426 (Studio). Put
   `TELETRAAN_LISTEN='<the Tailscale address of the computer>'` in `local.env` and run
   `docker compose --env-file local.env up -d` in `/opt/teletraan/current/computer`. Docker puts its own rules ahead of the
   firewall of the computer, so `ufw` alone does not close the ports.
3. Turn on two step sign-in for every GitHub account that can push to the repository, and protect the `main` branch
   (require a pull request, no force push). The Update button installs whatever `main` holds.
4. In Sanity, under the project's API, CORS origins: allow credentials only for the hosted Studio and the Tailscale name.
5. Check the tokens. `SANITY_WRITE_TOKEN` should have Editor access, not Administrator or Developer. Take
   `SANITY_AUTH_TOKEN` out of `local.env` unless a deploy is running. Make new tokens when someone who had SSH access
   leaves, and if a token was ever pasted into chat, email or a screenshot.
6. Photos: take the location out of a picture before it is uploaded.
7. The Sanity dataset is public. First names only, no emails, no phone numbers, nothing secret in any document. The sweep
   (`tools/sweep.sh`) refuses a key-shaped string in the repository.
8. After an update that changes unit files, nginx or compose files, run Install everything in the Mac tool once.
