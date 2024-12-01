/*
todo:
- Settings:
    - Enabled, but give clickable "generate index" buttons
- improve system prompt
- Caching (if it generated all sections)
 */

// using var, let at times failed to load in time
var pluginAlreadyProcessedClassName = "article-index-ai-plugin-already-processed";
var pluginContainerDivClassName = "article-index-ai-plugin-container-div";
var pluginOlClassName = "article-index-ai-plugin-ol";
var pluginOlSpanHeaderClassName = "article-index-ai-plugin-ol-span-header";
var pluginUpArrowToIndexClassName = "article-index-ai-plugin-up-arrow-to-index";
var pluginRightArrowClassName = "article-index-ai-plugin-right-arrow";
var pluginDownArrowClassName = "article-index-ai-plugin-down-arrow";
var pluginOlDivHiddenClassName = "article-index-ai-plugin-ol-div-hidden";
var pluginOlDivVisibleClassName = "article-index-ai-plugin-ol-div-visible";
var pluginLoadingIndicatorId = "article-index-ai-plugin-loading-indicator";
var pluginArticleIndexHeadingClassName = "article-index-ai-plugin-article-index-heading";

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
    return Array.from(document.querySelectorAll(`${elementName}:not(:has(${elementName})):not(.${pluginAlreadyProcessedClassName})`))
        .filter(el => el.innerText.trim().length >= minCharLength);
}

function findElementsMatchingClassWildcard(classNameWildcard, minCharLength) {
    return Array.from(document.querySelectorAll(`[class*="${classNameWildcard}"]:not(.${pluginAlreadyProcessedClassName})`))
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
    if (elementsToSummarize.length === 0) {
        elementsToSummarize = findElementsMatchingClassWildcard("post", minCharLength);
    }

    for (const element of elementsToSummarize) {
        element.classList.add(pluginAlreadyProcessedClassName);
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
    if (!element) {
        return null;
    }
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
function addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength, articleIndexId, doAddArrowLinkToId) {
    squashed.push(currentGroup);

    // use the first word, to find the starting tag in HTML
    const firstWord = currentGroup.substring(0, currentGroup.indexOf(" "));
    let newId = setIdOnElement(lastId, paragraphContainerElement, firstWord, paragraphsSquashedIdList, lastGroupLength);

    if (doAddArrowLinkToId && newId) {
        addArrowLinkToId(newId, articleIndexId);
    }

    return newId;
}

function addArrowLinkToId(elementIdToGetArrow, targetId) {
    let element = document.getElementById(elementIdToGetArrow);
    element.classList.add(pluginUpArrowToIndexClassName);
    element.onclick = (event) => {
        const arrowWidth = 24; // Width of the arrow image in pixels
        if (event.offsetX <= arrowWidth) {
            document.getElementById(targetId).scrollIntoView({behavior: 'smooth'});
        }
    };
}

function squashParagraphs(paragraphs, maxCharLength, paragraphContainerElement, articleIndexId) {
    let squashed = []
    let paragraphsSquashedIdList = []

    let lastId = null;
    let lastGroupLength = 0;
    let currentGroup = "";
    let runningLength = 0;

    let moreThanOneSection = paragraphs.map(x => x.length).reduce((x, y) => x + y) > maxCharLength;

    for (const paragraph of paragraphs) {
        let candidateLength = runningLength + paragraph.length;
        if (candidateLength < maxCharLength) {
            runningLength = candidateLength;
            currentGroup += " " + paragraph;
            currentGroup = currentGroup.trim();
        } else {
            if (currentGroup.length > 0) {
                lastId = addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength, articleIndexId, moreThanOneSection);
                lastGroupLength = currentGroup.length;
            }
            currentGroup = paragraph.substring(0, maxCharLength);
            runningLength = currentGroup.length;
        }
    }
    if (currentGroup.length > 0) {
        addSquashedParagraph(squashed, currentGroup, lastId, paragraphContainerElement, paragraphsSquashedIdList, lastGroupLength, articleIndexId, moreThanOneSection);
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
                margin-bottom: 2em;
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
                font-size: 1.1em;
                font-family: "Libre Franklin", Spectral, serif;
                cursor: pointer;
                font-weight: 500;
                line-height: 0.6em;
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
            
            .${pluginRightArrowClassName}::after, .${pluginUpArrowToIndexClassName}::before {
              background-color: #60c0ed;
              font-family: times, serif;
              padding: 0.4em 0.4em 0.2em 0.4em;
              margin-right: 3px;
              font-size: 0.4em;
              border-radius: 5px;
              color: white;
              cursor: pointer;
              pointer-events: auto; /* Enable pointer events */
              border-left: 2px solid transparent;
              border-right: 1px solid transparent;
              position: relative;
              bottom: 5px;
            }
            
            .${pluginUpArrowToIndexClassName}::before {
                content: "▲";
                padding: 0.6em;
            }
            
            h3.${pluginArticleIndexHeadingClassName} {
              font-size: 1.2em;
              font-family: monospace;
              margin-bottom: 5px;
            }
            
            #${pluginLoadingIndicatorId} {
              float: left;
            }
            `;
    document.head.appendChild(styleElement);
}

/*
param `relaxed` - if true, the check is less strict
 */
function containsInvalidWord(summary, relaxed) {
    return !relaxed && summary.toLowerCase().includes("key idea")
        || !relaxed && summary.toLowerCase().includes("key 1")
        || !relaxed && summary.toLowerCase().includes("keyidea")
        || !relaxed && summary.toLowerCase().includes("articleindex")
        || !relaxed && summary.toLowerCase().includes("article index")
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
    } else {
        const brElement = document.createElement("br");
        articleIndexDiv.appendChild(brElement);
    }
}

async function main() {
    addPluginStyles();

    let elementsToSummarize = getElementsToSummarize();

    for (const element of elementsToSummarize) {
        const articleIndexDiv = document.createElement("div");
        articleIndexDiv.classList.add(pluginContainerDivClassName);
        articleIndexDiv.id = getRandomElementId();

        const articleIndexH3 = document.createElement("h3");
        articleIndexH3.textContent = "article-idx"
        articleIndexH3.classList.add(pluginArticleIndexHeadingClassName);
        articleIndexDiv.appendChild(articleIndexH3);

        let allParagraphs = extractParagraphs(element.innerText);

        let {
            paragraphsSquashed,
            paragraphsSquashedIdList
        } = squashParagraphs(allParagraphs, maxCharLength, element, articleIndexDiv.id);

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

function removeLastComma(input) {
    let lastComma = input.lastIndexOf(",");
    let lastDoubleQuote = input.lastIndexOf('"');

    if (lastComma > lastDoubleQuote) {
        return input.substring(0, lastDoubleQuote + 1) + input.substring(lastComma + 1);
    }

    return input;
}

function fixDoubleQuotesWithinDoubleQuotes(summary) {
    let result = '';
    summary = summary.trim();
    let lastDoubleQuoteIndex = summary.lastIndexOf('"');
    let additionalAppend = "";
    for (let i = 0; i < summary.length; i++) {
        let c = summary[i];
        if (c === '\n') {
            continue;
        }
        if (c === '"') {
            let isFirstCharOfSummary = (i === summary.indexOf('"'));
            let isLastDoubleQuote = (i === lastDoubleQuoteIndex);
            let nextChar = summary[i + 1] || '';
            let prevChar2 = summary[i - 2] || '';

            if (
                !isFirstCharOfSummary &&    // Not the first character of the summary
                !isLastDoubleQuote &&       // Not the last double quote in the summary
                nextChar !== ':' &&         // Not followed by a colon
                nextChar !== ',' &&         // Not followed by a comma
                nextChar !== '}' &&         // Not followed by a closing brace
                prevChar2 !== ':' &&        // Not preceded by a colon two characters back
                prevChar2 !== ','           // Not preceded by a comma two characters back
            ) {
                // Skip this double quote
                continue;
            }
        } else if (c === ',' && summary[i - 1] === '"') {
            // add a missing double quote after a comma
            for (let k = i + 1; k < i + 10; k++) {
                if (k < summary.length) {
                    let charAt = summary[k];
                    if ((charAt >= 'a' && charAt <= 'z') || (charAt >= 'A' && charAt <= 'Z')) {
                        additionalAppend = '"';
                        break;
                    }
                    if (charAt === '"') {
                        break;
                    }
                }
            }
        }
        result += c + additionalAppend;
        additionalAppend = "";
    }

    return result;
}

function findLastCharacterIndex(input) {
    const pattern = /[a-zA-Z0-9.?!]/g;
    let lastIndex = -1;

    let match;
    while ((match = pattern.exec(input)) !== null) {
        lastIndex = match.index;
    }

    return lastIndex;
}

function addMissingDoubleQuote(summary) {
    let lastAlphaNumeric = findLastCharacterIndex(summary);
    let lastDoubleQuote = summary.lastIndexOf('"');

    if (lastAlphaNumeric > lastDoubleQuote) {
        return summary.substring(0, lastAlphaNumeric + 1) + '"' + summary.substring(lastAlphaNumeric + 1);
    }

    return summary;
}

function fixBasicJsonMistakes(summary) {
    let line = removeLastComma(summary);
    line = fixDoubleQuotesWithinDoubleQuotes(line);
    return addMissingDoubleQuote(line);
}

function removeBackSlashes(summary) {
    let line = summary.replaceAll('\\', '');
    return line.replaceAll('\b', 'b');
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
            let lastValidSummaryJson = "";
            let lastValidSummary = "";

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
                            try {
                                summary = fixBasicJsonMistakes(summary);
                                summaryJson = JSON.parse(summary);
                            } catch (err) {
                                summary = fixBasicJsonMistakes(removeBackSlashes(summary));
                                summaryJson = JSON.parse(summary);
                            }
                        }
                    } catch (err) {
                        console.log(`Error parsing summary json. Summary ${summary}; Error: ${err}`);
                        errorOccurred = true;

                        if (attempts === max_attempts) {
                            summaryJson = lastValidSummaryJson;
                            summary = lastValidSummary;
                            errorOccurred = false;
                        }
                    }

                    if (containsInvalidWord(summary, attempts === max_attempts)) {
                        lastValidSummaryJson = summaryJson;
                        lastValidSummary = summary;
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

chrome.storage.sync.get('whitelist', function (data) {
    let whitelist = data.whitelist || [];
    if (whitelist.length === 1 && whitelist[0] === '') {
        whitelist = [];
    }
    const currentHost = window.location.hostname;

    const regexList = whitelist.map(pattern => {
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special characters
        return new RegExp('^' + escapedPattern.replace(/\\\*/g, '.*') + '$');
    });

    const isWhitelisted = regexList.some(regex => regex.test(currentHost));

    if (whitelist.length === 0 || isWhitelisted) {
        console.log('This site is whitelisted, will generate article idx');
        (async () => {
            await initPlugin();
        })();
    } else {
        console.log('This site is not whitelisted, will not generate article idx.');
    }
});

async function initPlugin() {
    if (await aiAvailable()) {
        await main();

        // add a hook for ajax requests
        (function () {
            const oldFetch = window.fetch;

            window.fetch = function (...args) {
                return oldFetch.apply(this, args)
                    .then(response => {
                        response.clone().text().then(body => {
                            main();
                        });
                        return response;
                    });
            };
        })();

        (function () {
            const oldXHR = window.XMLHttpRequest;

            function newXHR() {
                const xhr = new oldXHR();

                xhr.addEventListener('readystatechange', function () {
                    if (xhr.readyState === 4) {
                        console.log('AJAX finished:', xhr.responseURL);
                        main();
                    }
                });

                return xhr;
            }

            window.XMLHttpRequest = newXHR;
        })();
    }
}

