/*
todo:
- let the "Section" take you to that part of the article. (remove Source). (and a little arrow to jump back up?)
- Can we make it "triggered"? Or we just make it configurable which domains use this.
- Better/consistent style
- Caching (if it generated all sections)
 */

var pluginContainerDivClassName = "article-index-ai-plugin-container-div";
var pluginOlClassName = "article-index-ai-plugin-ol";
var pluginOlSpanHeaderClassName = "article-index-ai-plugin-ol-span-header";
var pluginRightArrowClassName = "article-index-ai-plugin-right-arrow";
var pluginDownArrowClassName = "article-index-ai-plugin-down-arrow";
var pluginOlDivHiddenClassName = "article-index-ai-plugin-ol-div-hidden";
var pluginOlDivVisibleClassName = "article-index-ai-plugin-ol-div-visible";
var pluginLoadingIndicatorId = "article-index-ai-plugin-loading-indicator";
var pluginHighlightedTextClassName = "article-index-ai-plugin-highlighted-text";

async function createSession() {
    return await ai.languageModel.create({
        systemPrompt: `You summarize text. Your input will be a piece of text, and your role is to identify 3 key ideas. Present the 3 key ideas as a JSON map. 
        Provide 1 word as the heading (main idea of the sentence)(string, the key of the map entry), followed by a sentence (string) to explain the idea (the value of the map entry). Do not provide anything outside the JSON output.
        Example output:
        {
            "Example Heading 1": "Example Idea 1",
            "Example Heading 2": "Example Idea 2",
            "Example Heading 3": "Example Idea 3"
        }
       `
    });
}

let session;
const maxCharLength = 4500;

async function getSummary(text) {
    if (!session) {
        session = await createSession();
    }
    return session.prompt(text);
}

function findElementsMatchingName(elementName, minCharLength) {
    return Array.from(document.querySelectorAll(`${elementName}:not(:has(${elementName}))`))
        .filter(el => el.innerText.trim().length >= minCharLength);
}

function findElementsMatchingClassWildcard(classNameWildcard, minCharLength) {
    return Array.from(document.querySelectorAll(`[class*="${classNameWildcard}"]`))
        .filter(el => !el.querySelector(`[class*="${classNameWildcard}"]`)
            && el.innerText.trim().length >= minCharLength);
}

function getElementsToSummarize() {
    const minCharLength = 1000;
    let elementsToSummarize = findElementsMatchingName("article", minCharLength);
    if (elementsToSummarize.length === 0) {
        elementsToSummarize = findElementsMatchingClassWildcard("content", minCharLength);
    }
    if (elementsToSummarize.length === 0) {
        elementsToSummarize = findElementsMatchingClassWildcard("review", minCharLength);
    }
    return elementsToSummarize || [];
}

function extractParagraphs(inputString) {
    return inputString
        .split(/\n+/)
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0);
}

function getRandomElementId() {
    return "article-index-ai-plugin-" + Math.random() * 100_000;
}

function findImmediateParentContainingText(mainElement, text) {
    const elements = mainElement.querySelectorAll('*');
    for (const element of elements) {
        if (element.childNodes.length > 0) {
            for (const node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.toLowerCase().includes(text.toLowerCase())) {
                    return element;
                }
            }
        }
    }
    return null;
}

function findImmediateParentContainingTextAfterId(mainElement, text, startingId, lastGroupLength) {
    let passedIdElement = true;
    if (startingId) {
        const idElement = document.getElementById(startingId);
        if (idElement) {
            passedIdElement = false;
        }
    }
    let found = null;
    let charCount = 0;

    function traverse(node) {
        if (found) return;

        if (!passedIdElement && node.nodeType === Node.ELEMENT_NODE && node.id === startingId) {
            // get the deepest child, we may have a top-level article element, where then textContent is the entire article e.g. https://www.viksnewsletter.com/p/short-intro-to-automotive-lidar#article-index-ai-plugin-20372.110770104457
            // let childNode = node.firstChild;
            // let childToUse = node;
            // while (childNode) {
            //     childToUse = childNode;
            //     childNode = childNode.firstChild;
            // }
            // if (node.nodeValue) {
            //     charCount += node.nodeValue.length;
            // } else {
            //     let childNode = node.firstChild;
            //     while (childNode && childNode.textContent && childNode.textContent > lastGroupLength) {
            //         childNode = childNode.firstChild;
            //     }
            //     if (childNode) {
            //         charCount += childNode.textContent.length;
            //     }
            // }
            charCount += node.textContent.length;
            passedIdElement = true;
            return; // Skip the subtree of the element with the specified startingId
        }

        // If we've passed the startingId element, check for the text
        if (passedIdElement && node.nodeValue) {

            if (charCount + node.nodeValue.length >= lastGroupLength) {
                let index = node.nodeValue.toLowerCase().indexOf(text.toLowerCase());
                if (index !== -1) {
                    if (node.previousSibling && node.previousSibling.nodeValue && node.previousSibling.nodeValue.length < 10) {
                        found = node.previousSibling;
                    } else {
                        found = node.parentElement;
                    }
                    return;
                }
            }
            charCount += node.nodeValue.length;
        }

        let child = node.firstChild;
        while (child) {
            traverse(child);
            child = child.nextSibling;
        }
    }

    traverse(mainElement);

    return found;
}

/*
returns the id of the first element in the section
 */
function setIdOnElement(lastId, paragraphContainerElement, firstWord, paragraphsSquashedIdList, lastGroupLength) {
    let element = findImmediateParentContainingTextAfterId(paragraphContainerElement, firstWord, lastId, lastGroupLength);
    let idUsed = -1;
    if (element.id) {
        paragraphsSquashedIdList.push(element.id);
        idUsed = element.id;
    } else {
        const newId = getRandomElementId();
        element.id = newId;
        paragraphsSquashedIdList.push(newId);
        idUsed = newId;
    }

    return idUsed;
}

/*
returns the id of the first element in the section
 */
function addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength) {
    squashed.push(currentGroup);

    // use the first word, to find the starting tag in HTML
    const firstWord = currentGroup.substring(0, currentGroup.indexOf(" "));
    return setIdOnElement(lastId, paragraphContainerElement, firstWord, paragraphsSquashedIdList, lastGroupLength);
}

function squashParagraphs(paragraphs, maxCharLength, paragraphContainerElement) {
    let squashed = []
    let paragraphsSquashedIdList = []
    debugger

    let lastId = null;
    let lastGroupLength = 0;
    let currentGroup = "";
    let runningLength = 0;

    for (const paragraph of paragraphs) {
        let candidateLength = runningLength + paragraph.length;
        if (candidateLength < maxCharLength) {
            runningLength = candidateLength;
            currentGroup += " " + paragraph;
        } else {
            if (currentGroup.length > 0) {
                lastId = addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength);
                lastGroupLength = currentGroup.length;
            }
            currentGroup = paragraph.substring(0, maxCharLength);
            runningLength = currentGroup.length;
        }
    }
    if (currentGroup.length > 0) {
        addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength);
    }

    return {
        paragraphsSquashed: squashed,
        paragraphsSquashedIdList: paragraphsSquashedIdList
    };
}

function createSummaryElement(summaryJson) {
    const ol = document.createElement("ol");
    ol.classList.add(pluginOlClassName);

    for (const [header, text] of Object.entries(summaryJson)) {
        const li = document.createElement("li");

        const spanHeader = document.createElement("span");
        spanHeader.textContent = header;
        spanHeader.classList.add(pluginOlSpanHeaderClassName);
        spanHeader.classList.add(pluginRightArrowClassName);

        const ideaTextDiv = createCollapsibleDiv(text, spanHeader);

        li.appendChild(spanHeader);
        li.appendChild(ideaTextDiv);

        ol.appendChild(li);
    }

    return ol;
}

function addPluginStyles() {
    const styleElement = document.createElement('style');
    styleElement.id = "article-index-ai-plugin-style-id"
    styleElement.textContent = "" +
        `
        .${pluginContainerDivClassName} {
            padding-left: 2em;
        }
        .${pluginOlClassName} { 
            padding-left: 3em; 
        }
        .${pluginOlDivHiddenClassName} {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 0.1s ease, opacity 0.1s ease;
        }
        
        .${pluginOlDivVisibleClassName} {
          max-height: 500px;
          opacity: 1;
          transition: max-height 0.3s ease, opacity 0.3s ease;
        }
        
        .${pluginOlSpanHeaderClassName} {
            cursor: pointer;
            font-weight: bold;
        }
        .${pluginOlSpanHeaderClassName}:hover {
            text-decoration: underline;
        }
        .${pluginRightArrowClassName}::after {
          content: "▶";
          font-size: 0.8em;
          margin-left: 10px;
          transition: transform 0.3s ease;
          display: inline-block;
        }
       .${pluginDownArrowClassName}::after {
          transform: rotate(90deg);
          transition: transform 0.3s ease;
        }
        
        .${pluginHighlightedTextClassName} {
            background-color: #f3f3c0;
            transition: transform 0.3s ease;
        }
        `;
    document.head.appendChild(styleElement);
}

function containsInvalidWord(summary) {
    return summary.toLowerCase().includes("key idea")
        || summary.toLowerCase().includes("key 1")
        || summary.toLowerCase().includes("keyidea")
        || summary.toLowerCase().includes("articleindex")
        || summary.toLowerCase().includes("article index")
        || summary.toLowerCase().includes("example heading")
        || summary.toLowerCase().includes("example idea")
        || summary.toLowerCase().includes("object Object");
}

function createCollapsibleDiv(text, collapsibleToggleElement) {
    const ideaTextDiv = document.createElement("div");
    ideaTextDiv.innerHTML = text;
    ideaTextDiv.classList.add(pluginOlDivHiddenClassName)

    collapsibleToggleElement.onclick = () => {
        if (ideaTextDiv.classList.contains(pluginOlDivHiddenClassName)) {
            ideaTextDiv.classList.remove(pluginOlDivHiddenClassName);
            ideaTextDiv.classList.add(pluginOlDivVisibleClassName);
            collapsibleToggleElement.classList.add(pluginDownArrowClassName);
        } else {
            ideaTextDiv.classList.remove(pluginOlDivVisibleClassName);
            ideaTextDiv.classList.add(pluginOlDivHiddenClassName);
            collapsibleToggleElement.classList.remove(pluginDownArrowClassName);
        }
    };

    return ideaTextDiv;
}

function appendElements(counter, articleIndexDiv, summaryJson, doAppendSection, paragraphsSquashedId, doAppendSummary) {
    if (doAppendSection) {
        const sectionLink = document.createElement("a");
        sectionLink.textContent = `Section ${counter}`;
        sectionLink.href = `#${paragraphsSquashedId}`
        articleIndexDiv.appendChild(sectionLink);
    }

    if (doAppendSummary) {
        const summaryElement = createSummaryElement(summaryJson);
        articleIndexDiv.appendChild(summaryElement);
    }
}

async function main() {
    addPluginStyles();

    let elementsToSummarize = getElementsToSummarize();

    for (const element of elementsToSummarize) {
        const articleIndexDiv = document.createElement("div");
        articleIndexDiv.classList.add(pluginContainerDivClassName);

        const articleIndexH3 = document.createElement("h3");
        articleIndexH3.textContent = "Article Index (AI generated)"
        articleIndexDiv.appendChild(articleIndexH3);

        let allParagraphs = extractParagraphs(element.innerText);

        let {
            paragraphsSquashed,
            paragraphsSquashedIdList
        } = squashParagraphs(allParagraphs, maxCharLength, element);

        element.prepend(articleIndexDiv);

        await processParagraphs(paragraphsSquashed, paragraphsSquashedIdList, articleIndexDiv);
    }
}

function addLoadingIndicator(parent) {
    const loader = document.createElement('div');
    loader.id = pluginLoadingIndicatorId;
    loader.innerHTML = "<img alt='loading' src='https://cdn.pixabay.com/animation/2024/04/02/07/57/07-57-40-974_256.gif' style='width: 30px; height: 30px;'>";
    parent.appendChild(loader);
}

function removeLoadingIndicator(parent) {
    const loader = parent.querySelector(`#${pluginLoadingIndicatorId}`);
    if (loader) loader.remove();
}

/*
Fixes double quotes within double quotes.
 */
function fixBasicJsonMistakes(summary) {
    const lines = summary.split('\n');

    const processedLines = lines.map(line => {
        let result = '';
        line = line.trim();
        let lastDoubleQuoteIndex = line.lastIndexOf('"');

        for (let i = 0; i < line.length; i++) {
            let c = line[i];
            if (c === '"') {
                // Check if this double quote should be removed
                let isFirstCharOfLine = (i === 0);
                let isLastDoubleQuote = (i === lastDoubleQuoteIndex);
                let nextChar = line[i + 1] || '';
                let prevChar1 = line[i - 1] || '';
                let prevChar2 = line[i - 2] || '';

                if (
                    !isFirstCharOfLine &&    // Not the first character of the line
                    !isLastDoubleQuote &&    // Not the last double quote in the line
                    nextChar !== ':' &&      // Not followed by a colon
                    nextChar !== ',' &&      // Not followed by a comma
                    prevChar1 !== ':' &&     // Not preceded by a colon
                    prevChar2 !== ':'        // Not preceded by a colon two characters back
                ) {
                    // Skip this double quote
                    continue;
                }
            }
            // Add the character to the result
            result += c;
        }
        return result;
    });

    // Join the processed lines back into a single string
    return processedLines.join('\n');
}

async function processParagraphs(paragraphsSquashed, paragraphsSquashedIdList, articleIndexDiv) {
    let counter = 0;

    for (const paragraphSquash of paragraphsSquashed) {
        try {
            let paragraphsSquashedId = paragraphsSquashedIdList[counter];
            addLoadingIndicator(articleIndexDiv);
            counter += 1;
            let attempts = 0;
            let max_attempts = 4;
            let errorOccurred = false;
            let summaryJson = "";

            while (attempts < max_attempts) {
                try {
                    attempts += 1;

                    let summary = "";
                    try {
                        summary = await getSummary(paragraphSquash);
                    } catch (err) {
                        console.log(`Error generating summary: ${err}`);
                        errorOccurred = true;
                    }

                    try {
                        try {
                            summaryJson = JSON.parse(summary);
                        } catch (err) {
                            summary = fixBasicJsonMistakes(summary);
                            summaryJson = JSON.parse(summary);
                        }
                    } catch (err) {
                        console.log(`Error parsing summary json. Summary ${summary}; Error: ${err}`);
                        errorOccurred = true;
                    }

                    if (containsInvalidWord(summary)) {
                        console.log(`Summary container an invalid word ${summary}`);
                        errorOccurred = true;
                    }

                    if (!errorOccurred) {
                        break;
                    }
                } catch (e) {
                    console.log("Error occurred", e);
                }
            }

            let doAppendSection = counter > 1 || paragraphsSquashed.length > 1;
            appendElements(counter, articleIndexDiv, summaryJson, doAppendSection, paragraphsSquashedId, !errorOccurred);
        } finally {
            removeLoadingIndicator(articleIndexDiv);
        }
    }
}

// function getTopmostElement(elements) {
//     return Array.from(elements).reduce((topmost, current) => {
//         const topmostY = topmost.getBoundingClientRect().top;
//         const currentY = current.getBoundingClientRect().top;
//         return currentY < topmostY ? current : topmost;
//     });
// }

/*
Identify areas to summarize.

Identify paragraphs.

If < 600 chars, ignore.

take paragraphs, while < 5000 characters
if paragraph is larger than 5000 characters, then break up into sentences.

Take up to < 5000 characters of text.

summarize

wrap the text summarized in a span, with a specific id

at the top of the article, add a section ArticleIndex (AI generated):
(Can we highlight the text after the user clicked the hyperlink, and then fade away)
Section #1 -> Hyperlink
- Point #1
- Point #2
- Point #3

Section #2 -> Hyperlink
- Point #1
- Point #2
- Point #3

Section #3 -> Hyperlink
- Point #1
- Point #2
- Point #3
 */

async function aiAvailable() {
    return typeof (ai) === "object" && (await ai.languageModel.capabilities()).available === 'readily';
}

async function x() {

}

if (await aiAvailable()) {
    // add a hook for ajax requests
    window.addEventListener("ajaxComplete", async (event) => {
        x();
    });
}
