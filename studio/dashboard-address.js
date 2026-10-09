// The address that Preview the screen opens on the Start here page (start-here.js).
// The Mini's web server only answers on the Mini itself (deploy/docker-compose.yml),
// so this address shows a page in the Mini's own browser and nowhere else. If the
// screen is ever reachable at another address, change it here and nowhere else.
// ?sample=1 makes the screen show the sample content. Without it the screen shows
// what the editors published, and sample content is reached no other way.
export const dashboardAddress = 'http://localhost:3229/dashboard/?sample=1';
