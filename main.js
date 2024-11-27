/*
todo:
- loading indicator
- let the "Section" take you to that part of the article. (remove Source). (and a little arrow to jump back up?)
- Can we make it "triggered"?
 */

const pluginContainerDivClassName = "article-index-ai-plugin-container-div";
const pluginOlClassName = "article-index-ai-plugin-ol";
const pluginOlSpanHeaderClassName = "article-index-ai-plugin-ol-span-header";
const pluginRightArrowClassName = "article-index-ai-plugin-right-arrow";
const pluginDownArrowClassName = "article-index-ai-plugin-down-arrow";
const pluginOlDivHiddenClassName = "article-index-ai-plugin-ol-div-hidden";
const pluginOlDivVisibleClassName = "article-index-ai-plugin-ol-div-visible";

async function createSession() {
    return await ai.languageModel.create({
        systemPrompt: `You summarize text. Your input will be a piece of text, and your role is to identify 3 key ideas. Present the 3 key ideas as a JSON map. 
        Provide 1 word as the heading (main idea of the sentence) (the key of the map), followed by a sentence (string) to explain the idea (the value).
        Example output:
        {
            "Example Heading 1": "Example Idea 1",
            "Example Heading 2": "Example Idea 2",
            "Example Heading 3": "Example Idea 3"
        }
       `
    });
}

async function getSummary(text) {
    // if (!session) {
    let session = await createSession();
    // }
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


function squashParagraphs(paragraphs, maxCharLength) {
    let squashed = []
    let originalParagraphsList = []

    let originalParagraph = [];
    let currentGroup = "";
    let runningLength = 0;
    for (const paragraph of paragraphs) {
        let candidateLength = runningLength + paragraph.length;
        if (candidateLength < maxCharLength) {
            runningLength = candidateLength;
            currentGroup += paragraph;
            originalParagraph.push('<p>' + paragraph + '</p>');
        } else {
            if (currentGroup.length > 0) {
                squashed.push(currentGroup);
                originalParagraphsList.push(originalParagraph);
            }
            currentGroup = paragraph.substring(0, maxCharLength);
            originalParagraph = ['<p>' + paragraph.substring(0, maxCharLength) + '</p>'];
            runningLength = currentGroup.length;
        }
    }
    if (currentGroup.length > 0) {
        squashed.push(currentGroup);
        originalParagraphsList.push(originalParagraph);
    }

    return {
        paragraphsSquashed: squashed,
        originalParagraphsList: originalParagraphsList
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
          transition: max-height 0.3s ease, opacity 0.3s ease;
        }
        
        .${pluginOlDivVisibleClassName} {
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
        `;
    document.head.appendChild(styleElement);
}

function containsInvalidWord(summary) {
    return summary.toLowerCase().includes("key idea")
        || summary.toLowerCase().includes("keyidea")
        || summary.toLowerCase().includes("articleindex")
        || summary.toLowerCase().includes("article index")
        || summary.toLowerCase().includes("example heading")
        || summary.toLowerCase().includes("example idea");
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

function createAndAppendArticleSourceElement(originalParagraphsString, articleSourceParent) {
    const articleSourceElement = document.createElement("span");
    articleSourceElement.textContent = "Source";
    articleSourceElement.classList.add(pluginOlSpanHeaderClassName);
    articleSourceElement.classList.add(pluginRightArrowClassName);
    let sourceDiv = createCollapsibleDiv(originalParagraphsString, articleSourceElement);

    articleSourceParent.appendChild(articleSourceElement)
    articleSourceParent.appendChild(sourceDiv)
}


function appendElements(counter, articleIndexDiv, summaryJson, originalParagraphsString, doAppendSection) {
    if (doAppendSection) {
        const sectionLink = document.createElement("h3");
        sectionLink.textContent = `Section ${counter}`;
        articleIndexDiv.appendChild(sectionLink);
    }

    const summaryElement = createSummaryElement(summaryJson);
    articleIndexDiv.appendChild(summaryElement);

    createAndAppendArticleSourceElement(originalParagraphsString, articleIndexDiv);
}

async function main() {
    addPluginStyles();

    let elementsToSummarize = getElementsToSummarize();
    let maxCharLength = 4500;

    for (const element of elementsToSummarize) {
        const articleIndexDiv = document.createElement("div");
        articleIndexDiv.classList.add(pluginContainerDivClassName);

        const articleIndexH3 = document.createElement("h3");
        articleIndexH3.textContent = "Article Index (AI generated)"
        articleIndexDiv.appendChild(articleIndexH3);

        let allParagraphs = extractParagraphs(element.innerText);

        let {paragraphsSquashed, originalParagraphsList} = squashParagraphs(allParagraphs, maxCharLength);

        element.prepend(articleIndexDiv);

        await processParagraphs(paragraphsSquashed, originalParagraphsList, articleIndexDiv);
    }
}

async function processParagraphs(paragraphsSquashed, originalParagraphsList, articleIndexDiv) {
    let counter = 0;

    for (const paragraphSquash of paragraphsSquashed) {
        let originalParagraphs = originalParagraphsList[counter];
        let originalParagraphsString = originalParagraphs.join("");
        counter += 1;
        let attempts = 0;
        let max_attempts = 3;
        while (attempts < max_attempts) {
            attempts += 1;
            let errorOccurred = false;

            let summary = "";
            try {
                summary = await getSummary(paragraphSquash);
            } catch (err) {
                console.log(`Error generating summary: ${err}`);
                errorOccurred = true;
            }

            let summaryJson = "";
            try {
                summaryJson = JSON.parse(summary);
            } catch (err) {
                console.log(`Error parsing summary json. Summary ${summary}; Error: ${err}`);
                errorOccurred = true;
            }

            if (containsInvalidWord(summary)) {
                console.log(`Summary container an invalid word ${summary}`);
                errorOccurred = true;
            }

            if (!errorOccurred) {
                let doAppendSection = counter > 1 || paragraphsSquashed.length > 1;
                appendElements(counter, articleIndexDiv, summaryJson, originalParagraphsString, doAppendSection);
                break;
            }
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
