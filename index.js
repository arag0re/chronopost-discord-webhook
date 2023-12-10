const cheerio = require('cheerio');
let tabPattern = /\\t\s*/g;
let spacePattern = /(\d{2}\/\d{2}\/\d{4})(\d{2}:\d{2})([A-Za-z ]+)/;
let oldDeliveryData = [];
const webhookURL = 'https://ptb.discord.com/api/webhooks/xxxxx/xxxxx';
const imageURL = 'https://cdn.discordapp.com/attachments/xxxxx/xxxx.jpg'

async function sendToWebhook(entry) {
    let splitted = entry.split(" ")
    let isoDate = parseDateStringGerman(splitted[0] + " " + splitted[1] + " " + splitted[2]);
    splitted.shift()
    splitted.shift()
    splitted.shift()
    let joined = splitted.join(" ")
    const message = {
        embeds: [
            {
                title: 'Shipping Update',
                description: "Package is one step further!",
                color: 0x00ff00, // Color in hexadecimal (green in this example)
                fields: [
                    {
                        name: 'Update',
                        value: joined,
                    },
                ],
                image: {
                    url: imageURL,
                },
                timestamp: isoDate,
            },
        ],
    };

    const webhookResponse = await fetch(webhookURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
}

function parseDateStringGerman(inputString) {
    const germanDayNames = {
        "Montag": "Monday",
        "Dienstag": "Tuesday",
        "Mittwoch": "Wednesday",
        "Donnerstag": "Thursday",
        "Freitag": "Friday",
        "Samstag": "Saturday",
        "Sonntag": "Sunday"
    };
    const parts = inputString.split(" ");
    const germanDay = parts[0];
    const englishDay = germanDayNames[germanDay];
    const dateStr = [englishDay, ...parts.slice(1, 4)].join(" ");
    const parsedDate = parseDateStringEngl(dateStr)
    return parsedDate;
}

function parseDateStringEngl(inputString) {
    const dateParts = inputString.split(" ");
    const day = dateParts[0];
    const [dayOfMonth, month, year] = dateParts[1].split('/');
    const [hour, minute] = dateParts[2].split(':');
    const parsedDate = new Date(year, month - 1, dayOfMonth, hour, minute);
    return parsedDate;
}

async function loadTrackingInfos(listeNumerosLT, langue, proofOfDelivery) {
    try {
        const apiUrl = `https://www.chronopost.fr/tracking-no-cms/suivi-colis?&listeNumerosLT=${listeNumerosLT}&langue=${langue}&_=${proofOfDelivery}`;

        const response = await fetch(apiUrl, {
            credentials: 'include',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
                Accept: '*/*',
                'Accept-Language': 'en-GB,en;q=0.5',
                'X-Requested-With': 'XMLHttpRequest',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                Pragma: 'no-cache',
                'Cache-Control': 'no-cache',
            },
            referrer: `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${listeNumerosLT}`,
            method: 'GET',
            mode: 'cors',
        });

        if (!(response.ok)) {
            console.error(`Failed to fetch data. Status: ${response.status}`);
            return
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const shippingUpdateElements = $('tbody').children();
        if (!(shippingUpdateElements.length > 0)) {
            console.log('No shipping updates found on the website.');
            return
        }
        const shippingUpdatesArray = [];
        shippingUpdateElements.each((index, element) => {
            const shippingUpdateText = $(element).text();
            if (shippingUpdateText) {
                shippingUpdatesArray.push(shippingUpdateText.trim());
            }
        });

        let outputArray = shippingUpdatesArray.map((inputString) =>
            inputString.replace(tabPattern, '')
        );
        outputArray = outputArray.map((inputString) =>
            inputString.replace(spacePattern, "$1 $2 $3")
        );
        outputArray.shift();
        console.log("RequestTime " + Date() + ": \n" + outputArray)
        if (oldDeliveryData.length === 0) {
            // If oldDeliveryData is empty, save the current data as the old data
            oldDeliveryData = outputArray;
            await sendToWebhook(outputArray[0])
        } else {
            // Compare the new array with the old one
            outputArray.forEach(async (entry) => {
                if (!oldDeliveryData.includes(entry)) {
                    console.log('New entry:', entry);
                    await sendToWebhook(entry)
                }
            });
            oldDeliveryData = outputArray; // Update the old data
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Schedule the function to run every 5 minutes
loadTrackingInfos('XXXXXXXXXXXXX', 'de', Date.now()); //Chronopost data request
setInterval(() => {
    loadTrackingInfos('XXXXXXXXXXXXX', 'de', Date.now());
}, 2.5 * 60 * 1000); // 5 minutes in milliseconds
