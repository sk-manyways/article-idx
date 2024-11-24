let session;

async function createSession() {
    return await ai.languageModel.create({
        systemPrompt: `You summarize text. Your input will be a piece of text, and your role is to identify 3 key ideas. Present the 3 key ideas as a JSON map. 
        Provide 1 word as the heading (main idea of the sentence) (the key of the map), followed by a sentence to explain the idea (the value).
        Example output:
        {
            "ideaHeading1": "idea sentence1",
            "ideaHeading2": "idea sentence2",
            "ideaHeading3": "idea sentence3"
        }
       `
    });
}

async function getSummary(text) {
    if (!session) {
        session = await createSession();
    }
    return session.prompt(text);
}

function findElementsMatchingName(elementName, minCharLength) {
    return Array.from(document.querySelectorAll(elementName)).filter(el => el.textContent.trim().length >= minCharLength);
}

function findElementsMatchingClassWildcard(classNameWildcard, minCharLength) {
    return Array.from(document.querySelectorAll("*")).filter(el => String(el.className).toLowerCase().includes(classNameWildcard) && el.textContent.trim().length >= minCharLength);
}

function getElementsToSummarize() {
    const minCharLength = 600;
    let elementsToSummarize = findElementsMatchingName("article", minCharLength);
    if (!elementsToSummarize) {
        elementsToSummarize = findElementsMatchingClassWildcard("content", minCharLength);
    }
    return elementsToSummarize || [];
}

function extractParagraphs(inputString) {
    if (inputString.includes("<p>")) {
        return inputString
            .split(/<\/?p>/)
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph.length > 0);
    } else if (inputString.includes("<br>")) {
        return inputString
            .split(/<br\s*\/?>/)
            .map(paragraph => paragraph.trim())
            .filter(paragraph => paragraph.length > 0);
    } else {
        return [inputString.trim()];
    }
}

function squashParagraphs(paragraphs, maxCharLength) {
    let squashed = []

    let currentGroup = "";
    let runningLength = 0;
    for (const paragraph of paragraphs) {
        let candidateLength = runningLength + paragraph.length;
        if (candidateLength < maxCharLength) {
            runningLength = candidateLength;
            currentGroup += paragraph;
        } else {
            if (currentGroup.length > 0) {
                squashed.push(currentGroup);
            }
            currentGroup = paragraph.substring(0, maxCharLength);
            runningLength = currentGroup.length;
        }
    }
    if (currentGroup.length > 0) {
        squashed.push(currentGroup);
    }

    return squashed;
}

function createSummaryElement(summaryJson) {
    const ol = document.createElement("ol");

    for (const [header, text] of Object.entries(summaryJson)) {
        const li = document.createElement("li");

        const spanHeader = document.createElement("span");
        spanHeader.textContent = header;

        const spanText = document.createElement("span");
        spanText.textContent = text;

        li.appendChild(spanHeader);
        li.appendChild(spanText);

        ol.appendChild(li);
    }

    return ol;
}

async function main() {
    let elementsToSummarize = getElementsToSummarize();
    let maxCharLength = 4500;

    for (const element of elementsToSummarize) {
        const articleIndexDiv = document.createElement("div");
        const articleIndexH3 = document.createElement("h3");
        articleIndexH3.textContent = "Article Index (AI generated)"
        articleIndexDiv.appendChild(articleIndexH3);

        element.prepend(articleIndexDiv);

        let allParagraphs = extractParagraphs(element.innerHTML);

        let paragraphsSquashed = squashParagraphs(allParagraphs, maxCharLength);

        let counter = 0;
        for (const paragraphSquash of paragraphsSquashed) {
            counter += 1;
            const sectionLink = document.createElement("a");
            sectionLink.href = "#";
            sectionLink.textContent = `Section ${counter}`;
            articleIndexDiv.appendChild(sectionLink);

            let summary = "";
            try {
                summary = await getSummary(paragraphSquash);
            } catch (err) {
                console.log(`Error generating summary: ${err}`);
                continue;
            }

            let summaryJson = "";
            try {
                summaryJson = JSON.parse(summary);
            } catch (err) {
                console.log(`Error parsing summary json. Summary ${summary}; Error: ${err}`);
            }
            const summaryElement = createSummaryElement(summaryJson);
            console.log("appending element...");
            articleIndexDiv.appendChild(summaryElement);
            console.log("element appended");
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
