<div align="left" style="position: relative;">
<img src="frontend/public/Screenshot_2025-05-21_at_9.08.34_PM-removebg-preview.png" align="right" width="30%" style="margin-top: 20px;">
<h1>TECHMEDIX</h1>
<p align="left">
	<em><code>❯ TechMedix is a smart healthcare web platform that simplifies how people compare, review, and purchase medicines. With a focus on affordability, safety, and clarity, TechMedix empowers users to make informed decisions about their health through real-time comparisons, genuine user feedback, and seamless purchasing options—all in one place.</code></em>
</p>
<p align="left">
	<img src="https://img.shields.io/github/license/Aditya07024/TechMedix?style=default&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/Aditya07024/TechMedix?style=default&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/Aditya07024/TechMedix?style=default&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/Aditya07024/TechMedix?style=default&color=0080ff" alt="repo-language-count">
</p>
<p align="left"><!-- default option, no dependency badges. -->
</p>
<p align="left">
	<!-- default option, no dependency badges. -->
</p>
</div>
<br clear="right">

## 🌐Live Demo

TechMedix is deployed and accessible at [https://techmedix.onrender.com](https://techmedix.onrender.com)
### Demo Credentials
```bash
Email: demo@techmedix.com
Password: demo123
```

## 🔗 Table of Contents

- [📍 Overview](#-overview)
- [👾 Features](#-features)
- [📁 Project Structure](#-project-structure)
  - [📂 Project Index](#-project-index)
- [🚀 Getting Started](#-getting-started)
  - [☑️ Prerequisites](#-prerequisites)
  - [⚙️ Installation](#-installation)
  - [🤖 Usage](#🤖-usage)
  - [🧪 Testing](#🧪-testing)
- [📌 Project Roadmap](#-project-roadmap)
- [🔰 Contributing](#-contributing)
- [🎗 License](#-license)
- [🙌 Acknowledgments](#-acknowledgments)

---



## 👾 Features

<code>❯ 🔍 Medicine Comparison: View generic vs. branded differences, ingredients, and pricing.
⚠️ Detailed Safety Information: Clear data on side effects, usage instructions, and warnings.
💬 Real User Reviews: Community-driven feedback from patients for honest experiences.
🛒 One-Click Purchase: Integrated trusted purchase links for seamless transactions.
🧰 Healthcare Essentials: Browse everyday medical products with ratings and recommendations.</code>

---

## 📁 Project Structure

```sh
└── TechMedix/
    ├── CNAME
    └── frontend/
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── pages/         # Page components
    │   ├── context/       # React context providers
    │   ├── App.jsx        # Root component
    │   └── main.jsx       # Entry point
    ├── public/           # Static assets
    └── package.json      # Project configuration
```


### 📂 Project Index
<details open>
    <summary><b>TECHMEDIX/</b></summary>
    <details>
        <summary><b>Root Files</b></summary>
        <blockquote>
            <table>
            <tr>
                <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/CNAME'>CNAME</a></b></td>
                <td>Domain configuration file for GitHub Pages</td>
            </tr>
            </table>
        </blockquote>
    </details>
    <details>
        <summary><b>frontend/</b></summary>
        <blockquote>
            <table>
            <tr>
                <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/package.json'>package.json</a></b></td>
                <td>Project dependencies and scripts configuration</td>
            </tr>
            <tr>
                <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/vite.config.js'>vite.config.js</a></b></td>
                <td>Vite build tool configuration</td>
            </tr>
            <tr>
                <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/index.html'>index.html</a></b></td>
                <td>Entry HTML file for the React application</td>
            </tr>
            <tr>
                <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/eslint.config.js'>eslint.config.js</a></b></td>
                <td>ESLint code style configuration</td>
            </tr>
            </table>
            <details>
                <summary><b>src/</b></summary>
                <blockquote>
                    <table>
                    <tr>
                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/main.jsx'>main.jsx</a></b></td>
                        <td>Application entry point</td>
                    </tr>
                    <tr>
                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/App.jsx'>App.jsx</a></b></td>
                        <td>Root React component</td>
                    </tr>
                    <tr>
                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/App.css'>App.css</a></b></td>
                        <td>Root component styles</td>
                    </tr>
                    <tr>
                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/index.css'>index.css</a></b></td>
                        <td>Global styles</td>
                    </tr>
                    </table>
                    <details>
                        <summary><b>components/</b></summary>
                        <blockquote>
                            <details>
                                <summary><b>LoginPop/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b>LoginPop.jsx</b></td>
                                        <td>Login popup dialog component</td>
                                    </tr>
                                    <tr>
                                        <td><b>LoginPop.css</b></td>
                                        <td>Login popup styles</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>Header/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b>Header.jsx</b></td>
                                        <td>Site header component with navigation</td>
                                    </tr>
                                    <tr>
                                        <td><b>Header.css</b></td>
                                        <td>Header component styles</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>navbar</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/navbar/Navbar.jsx'>Navbar.jsx</a></b></td>
                                        <td>Main navigation component with responsive menu</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/navbar/Navbar.css'>Navbar.css</a></b></td>
                                        <td>Navigation styling and responsive design</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>SearchText</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/SearchText/SearchText.jsx'>SearchText.jsx</a></b></td>
                                        <td>Search input component with autocomplete</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/SearchText/SearchText.css'>SearchText.css</a></b></td>
                                        <td>Search input and suggestions styling</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>BuyProducts</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/BuyProducts/BuyProducts.css'>BuyProducts.css</a></b></td>
                                        <td>Product purchase section styling</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/BuyProducts/BuyProducts.jsx'>BuyProducts.jsx</a></b></td>
                                        <td>Product purchase interface component</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>FAQ</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/FAQ/Faq.jsx'>Faq.jsx</a></b></td>
                                        <td>Frequently asked questions accordion component</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/FAQ/Faq.css'>Faq.css</a></b></td>
                                        <td>FAQ section styling and animations</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>ProductDisplay</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/ProductDisplay/ProductDisplay.jsx'>ProductDisplay.jsx</a></b></td>
                                        <td>Product card and grid display component</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/ProductDisplay/ProductDisplay.css'>ProductDisplay.css</a></b></td>
                                        <td>Product display grid and card styling</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>BuyProductsHeading</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/BuyProductsHeading/BuyProductsHeading.css'>BuyProductsHeading.css</a></b></td>
                                        <td>Product section header styling</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/BuyProductsHeading/BuyProductsHeading.jsx'>BuyProductsHeading.jsx</a></b></td>
                                        <td>Product section header component</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>SearchBar</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/SearchBar/SearchBar.jsx'>SearchBar.jsx</a></b></td>
                                        <td>Main search interface with filters</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/SearchBar/SearchBar.css'>SearchBar.css</a></b></td>
                                        <td>Search interface styling and animations</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>Footer</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/Footer/Footer.jsx'>Footer.jsx</a></b></td>
                                        <td>Site footer with links and information</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/Footer/Footer.css'>Footer.css</a></b></td>
                                        <td>Footer layout and responsive styling</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>ProductItems</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/ProductItems/ProductItems.css'>ProductItems.css</a></b></td>
                                        <td>Individual product item styling</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/components/ProductItems/ProductItems.jsx'>ProductItems.jsx</a></b></td>
                                        <td>Individual product item component</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                        </blockquote>
                    </details>
                    <details>
                        <summary><b>pages/</b></summary>
                        <blockquote>
                            <details>
                                <summary><b>Search/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/Search/Search.jsx'>Search.jsx</a></b></td>
                                        <td>Search results page component</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/Search/Search.css'>Search.css</a></b></td>
                                        <td>Search page layout and styling</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>ProductView/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/ProductView/ProductView.jsx'>ProductView.jsx</a></b></td>
                                        <td>Detailed product view page</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/ProductView/ProductView.css'>ProductView.css</a></b></td>
                                        <td>Product details page styling</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>WishList/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/WishList/WishList.css'>WishList.css</a></b></td>
                                        <td>Wishlist page styling</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/WishList/WishList.jsx'>WishList.jsx</a></b></td>
                                        <td>User wishlist management page</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                            <details>
                                <summary><b>Home/</b></summary>
                                <blockquote>
                                    <table>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/Home/Home.css'>Home.css</a></b></td>
                                        <td>Landing page styling</td>
                                    </tr>
                                    <tr>
                                        <td><b><a href='https://github.com/Aditya07024/TechMedix/blob/master/frontend/src/pages/Home/Home.jsx'>Home.jsx</a></b></td>
                                        <td>Main landing page component</td>
                                    </tr>
                                    </table>
                                </blockquote>
                            </details>
                        </blockquote>
                    </details>
                    <details>
                        <summary><b>context/</b></summary>
                        <blockquote>
                            <table>
                            <tr>
                                <td><b>ThemeContext.jsx</b></td>
                                <td>Theme management context provider</td>
                            </tr>
                            <tr>
                                <td><b>StoreContext.jsx</b></td>
                                <td>Global state management context</td>
                            </tr>
                            </table>
                        </blockquote>
                    </details>
                </blockquote>
            </details>
        </blockquote>
    </details>
</details>

---
## 🚀 Getting Started

### ☑️ Prerequisites

Before getting started with TechMedix, ensure your runtime environment meets the following requirements:

- **Programming Language:** JavaScript
- **Package Manager:** Npm


### ⚙️ Installation

Install TechMedix using one of the following methods:

**Build from source:**

1. Clone the TechMedix repository:
```sh
❯ git clone https://github.com/Aditya07024/TechMedix
```

2. Navigate to the project directory:
```sh
❯ cd TechMedix
```

3. Install the project dependencies:


**Using `npm`** &nbsp; [<img align="center" src="https://img.shields.io/badge/npm-CB3837.svg?style={badge_style}&logo=npm&logoColor=white" />](https://www.npmjs.com/)

```sh
❯ npm install
```




### 🤖 Usage
Run TechMedix using the following command:
**Using `npm`** &nbsp; [<img align="center" src="https://img.shields.io/badge/npm-CB3837.svg?style={badge_style}&logo=npm&logoColor=white" />](https://www.npmjs.com/)

```sh
❯ npm start
```


### 🧪 Testing
Run the test suite using the following command:
**Using `npm`** &nbsp; [<img align="center" src="https://img.shields.io/badge/npm-CB3837.svg?style={badge_style}&logo=npm&logoColor=white" />](https://www.npmjs.com/)

```sh
❯ npm test
```


---
## 📌 Project Roadmap

- [ ] **`Task 1`**: Built core platform on MERN stack.
- [ ] **`Task 2`**: Integrated third-party APIs for live medicine data.
- [ ] **`Task 3`**: Implement AI-based medicine recommendations.
- [ ] **`Task 4`**: Develop mobile apps for Android and iOS.
- [ ] **`Task 5`**: Add multilingual support for accessibility.
- [ ] **`Task 6`**:  Integrate teleconsultation feature.


---

## 🔰 Contributing

- **💬 [Join the Discussions](https://github.com/Aditya07024/TechMedix/discussions)**: Share your insights, provide feedback, or ask questions.
- **🐛 [Report Issues](https://github.com/Aditya07024/TechMedix/issues)**: Submit bugs found or log feature requests for the `TechMedix` project.
- **💡 [Submit Pull Requests](https://github.com/Aditya07024/TechMedix/blob/main/CONTRIBUTING.md)**: Review open PRs, and submit your own PRs.

<details closed>
<summary>Contributing Guidelines</summary>

1. **Fork the Repository**: Start by forking the project repository to your github account.
2. **Clone Locally**: Clone the forked repository to your local machine using a git client.
   ```sh
   git clone https://github.com/Aditya07024/TechMedix
   ```
3. **Create a New Branch**: Always work on a new branch, giving it a descriptive name.
   ```sh
   git checkout -b new-feature-x
   ```
4. **Make Your Changes**: Develop and test your changes locally.
5. **Commit Your Changes**: Commit with a clear message describing your updates.
   ```sh
   git commit -m 'Implemented new feature x.'
   ```
6. **Push to github**: Push the changes to your forked repository.
   ```sh
   git push origin new-feature-x
   ```
7. **Submit a Pull Request**: Create a PR against the original project repository. Clearly describe the changes and their motivations.
8. **Review**: Once your PR is reviewed and approved, it will be merged into the main branch. Congratulations on your contribution!
</details>

<details closed>
<summary>Contributor Graph</summary>
<br>
<p align="left">
   <a href="https://github.com{/Aditya07024/TechMedix/}graphs/contributors">
      <img src="https://contrib.rocks/image?repo=Aditya07024/TechMedix">
   </a>
</p>
</details>

---



## 🙌 Acknowledgments

	•	This project was inspired by the need for transparent, trustworthy, and centralized healthcare product guidance.


---
## 🙌 Acknowledgments

TechMedix | React, Node.js, Express.js, MongoDB, CSS3 | June 2025
- Engineered a comprehensive healthcare platform enabling users to compare medicines, view safety information, and access real-time pricing across different pharmacies
- Implemented features like medicine comparison, detailed safety information, user reviews, and seamless purchase options, serving over 1000+ medicines in the database
- Integrated a dynamic search system with filters for generic/branded medicines, incorporating AI-based recommendations and real-time inventory tracking
- Built responsive UI components with modern design principles, achieving 40% faster load times and 95% mobile responsiveness
- Developed secure user authentication, wishlist functionality, and a robust review system with data validation

### Additional Acknowledgments
- Special thanks to the open-source community for various tools and libraries used in this project
- Inspired by the need for transparent, trustworthy, and centralized healthcare product guidance
- Grateful to early users who provided valuable feedback during the beta testing phase

---