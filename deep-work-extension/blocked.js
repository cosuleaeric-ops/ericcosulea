const params = new URLSearchParams(window.location.search);
const site = params.get("site");
if (site) {
  document.getElementById("message").textContent =
    "Accesul la " + site + " este blocat cât timp rulează sesiunea de work.";
}
