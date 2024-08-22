export const DateExtension = {
  name: 'Date',
  type: 'response',
  match: ({ trace }) =>
    trace.type === 'ext_date' || trace.payload.name === 'ext_date',
  render: async ({ trace, element }) => {
    const formContainer = document.createElement('form');

    // Get current date and time
    let currentDate = new Date();
    currentDate.setSeconds(0, 0); // Remove seconds and milliseconds
    let minDate = new Date(currentDate); // Min date is today

    let maxDate = new Date();
    maxDate.setMonth(currentDate.getMonth() + 2); // Set max date to 2 months from today

    // Convert to ISO string and remove seconds and milliseconds
    let minDateString = minDate.toISOString().slice(0, 16);
    let maxDateString = maxDate.toISOString().slice(0, 16);

    // Fetch blocked dates from the webhook
    const blockedDates = await fetchBlockedDates();

    formContainer.innerHTML = `
          <style>
            label {
              font-size: 0.8em;
              color: #888;
            }
            input[type="datetime-local"]::-webkit-calendar-picker-indicator {
                border: none;
                background: transparent;
                border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
                bottom: 0;
                outline: none;
                color: transparent;
                cursor: pointer;
                height: auto;
                left: 0;
                position: absolute;
                right: 0;
                top: 0;
                width: auto;
                padding:6px;
                font: normal 8px sans-serif;
            }
            .meeting input{
              background: transparent;
              border: none;
              padding: 2px;
              border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
              font: normal 14px sans-serif;
              outline:none;
              margin: 5px 0;
              &:focus{outline:none;}
            }
            .invalid {
              border-color: red;
            }
            .submit {
              background: linear-gradient(to right, #2e6ee1, #2e7ff1 );
              border: none;
              color: white;
              padding: 10px;
              border-radius: 5px;
              width: 100%;
              cursor: pointer;
              opacity: 0.3;
            }
            .submit:enabled {
              opacity: 1; /* Make the button fully opaque when it's enabled */
            }
          </style>
          <label for="date">Select your date/time</label><br>
          <div class="meeting"><input type="datetime-local" id="meeting" name="meeting" value="" min="${minDateString}" max="${maxDateString}" /></div><br>
          <input type="submit" id="submit" class="submit" value="Submit" disabled="disabled">
          `;

    const submitButton = formContainer.querySelector('#submit');
    const datetimeInput = formContainer.querySelector('#meeting');

    // Disable dates based on blocked dates
    datetimeInput.addEventListener('input', function () {
      const selectedDate = new Date(this.value);
      const selectedDateString = selectedDate.toISOString().split('T')[0];

      // Check if the selected date is in the blocked dates array
      if (blockedDates.includes(selectedDateString)) {
        datetimeInput.classList.add('invalid');
        submitButton.disabled = true;
      } else {
        datetimeInput.classList.remove('invalid');
        submitButton.disabled = false;
      }
    });

    datetimeInput.addEventListener('input', function () {
      if (this.value && !submitButton.disabled) {
        submitButton.disabled = false;
      } else {
        submitButton.disabled = true;
      }
    });

    formContainer.addEventListener('submit', function (event) {
      event.preventDefault();

      const datetime = datetimeInput.value;
      console.log(datetime);
      let [date, time] = datetime.split('T');

      formContainer.querySelector('.submit').remove();

      window.voiceflow.chat.interact({
        type: 'complete',
        payload: { date: date, time: time },
      });
    });

    element.appendChild(formContainer);
  },
};

// Function to fetch blocked dates from the webhook
async function fetchBlockedDates() {
  try {
    const response = await fetch('https://hook.us1.make.com/zrx2oe5yedtrkypxw4u1cnqkv7nivcbg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: new Date().toISOString(),
        timeMax: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
        items: [{ id: 'primary' }]
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const busyDates = [];

    if (data["array entry"] && Array.isArray(data["array entry"])) {
      const busyTimes = data["array entry"].join('\n');
      busyTimes.split('\n').forEach(entry => {
        const [datePart] = entry.split(' to ');
        busyDates.push(new Date(datePart).toISOString().split('T')[0]);
      });
    } else if (typeof data["array entry"] === 'string') {
      const busyTimes = data["array entry"];
      busyTimes.split('\n').forEach(entry => {
        const [datePart] = entry.split(' to ');
        busyDates.push(new Date(datePart).toISOString().split('T')[0]);
      });
    }

    return [...new Set(busyDates)]; // Return unique blocked dates
  } catch (error) {
    console.error('Error fetching blocked dates:', error);
    return [];
  }
}
