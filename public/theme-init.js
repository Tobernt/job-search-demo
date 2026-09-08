(function () {
  try {
    var theme =
      localStorage.getItem("jobsearchdemo.theme.v1") ||
      localStorage.getItem("jobsearchdemo.theme.v1");

    if (theme === "dark" || theme === "light") {
      localStorage.setItem("jobsearchdemo.theme.v1", theme);
    }

    if (!theme && matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    }

    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
