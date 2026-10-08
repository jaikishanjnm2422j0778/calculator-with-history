# Calculator

A modern, responsive calculator web app built with plain **HTML5, CSS3 and vanilla JavaScript**. There are no frameworks, no libraries, no build step and no `eval()`.

## Features

- Addition, subtraction, multiplication, division, decimals, `AC`, `DEL`, `±` and `%`
- Chained calculations work left to right (`5 + 3 × 2 = 16`)
- **History panel**: every result is remembered in the browser (last 50), and can be clicked to reuse
- Friendly error handling (`Cannot divide by zero`, invalid input, huge numbers)
- Full keyboard support
- Responsive layout for phones, tablets and desktops (including landscape)
- Accessible: semantic HTML, ARIA labels, visible focus states, reduced-motion support

## Getting started

```bash
git clone https://github.com/<your-username>/calculator.git
cd calculator
```

Then open `index.html` in your browser, or use the **Live Server** extension in VS Code (right-click `index.html` → *Open with Live Server*).

## Keyboard shortcuts

| Key | Action |
|---|---|
| `0`–`9`, `.` | Enter numbers |
| `+` `-` `*` `/` | Operators |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last digit |
| `Escape` | Clear all (closes History if it is open) |
| `%` | Percent |

## Percent behaviour

- After `+` or `−`, `%` means a percentage **of the first number**: `200 + 10 % =` gives `220`.
- Otherwise it divides by 100: `50 %` gives `0.5`.

## Project structure

```text
calculator/
├── index.html   # Page structure and accessible markup
├── style.css    # Design tokens, layout, responsive rules
├── script.js    # Calculator logic, history, keyboard support
├── README.md
├── LICENSE
└── .gitignore
```

## Publishing on GitHub Pages

1. Push the repo to GitHub.
2. Go to **Settings → Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Your calculator will be live at `https://<your-username>.github.io/calculator/`.

## License

MIT. See [LICENSE](LICENSE).
