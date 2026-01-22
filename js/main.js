


//==============================UTILITIES==============================//

// Toggle between light and dark themes
document.getElementById("theme-toggle").addEventListener("change", e => {
    document.documentElement.setAttribute(
        "data-theme",
        e.target.checked ? "dark" : "light"
    )
})
