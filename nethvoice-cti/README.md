# NethVoice CTI

NethVoice CTI is a web application allows the user to have a web phone to manage calls, modify the phonebook, handle the queues of a switchboard, use the chat between connected users and much more.

## Type of users

To better understand the needs of the different types of user who use NethVoice CTI, [this file on Figma](https://www.figma.com/file/VGP0wulIn47E7OHADG17A9/Personas?node-id=0%3A1) identifies 4 Personas.

## Project scaffolding

- **components** - contains the reusable components
  - The components are divided in subdirectories by macrosection, for example:
    - history
    - layout
    - login
    - operators
    - phonebook
    - common
    - settings
- **config** - contains the configuration files for the app
  - Build and project configuration are in the root directory of the project
- **lib** - contains functions that can be extracted from components
  - The files are divided by context, for example:
    - login.ts
    - notification.ts
    - operators.ts
    - phonebook.ts
    - websocket.ts
    - util.ts
- **pages** - contains all the pages of the application
  - There is a file for every app route, check the [Next.js routing docs](https://nextjs.org/docs/routing/introduction) for more info
- **models** - contains the models used by rematch
  - Check the [rematch models docs](https://rematchjs.org/docs/api-reference/models) for more info
- **public** - contains the static files
- **services** - contains the requests to the server's APIs
- **store** - contains the stores for rematch
  - Check the [rematch store docs](https://rematchjs.org/docs/api-reference/store) for more info
- **styles** - contains the styling files
- **theme** - contains classes used by the common components

## Tools

The project is initialized using [**Next.js**](https://nextjs.org/) with [**Typescript**](https://www.typescriptlang.org/) and uses [**Tailwind CSS**](https://tailwindcss.com/) for the design.

## Libraries

- [**rematch**](https://rematchjs.org/) & [**react-redux**](https://react-redux.js.org/) - for the management of the shared state between components
- [**axios**](https://axios-http.com/docs/intro) - for the http requests
- [**janus-gateway**](https://janus.conf.meetecho.com/docs/JS.html) - for comunication with the WebRTC server
- [**socket.io**](https://socket.io/) - for web socket connections

## Development

Requirements

- Node.js 12.22.0 or later

Install dependencies

```
npm install
```

Run locally in development mode:

```
npm run dev
```

Build locally:

```
npm run build
```

Start locally:

```
npm start
```

_Other command could be available in package.json scripts._

## Development Tools

To ensure a good development experince the following extensions are recommended for vscode:

- [TypeScrypt](https://code.visualstudio.com/docs/languages/typescript)
- [IntelliCode](https://marketplace.visualstudio.com/items?itemName=VisualStudioExptTeam.vscodeintellicode)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [ESlint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Build

The project can be locally built through containers.

Requirements

- [podman](https://podman.io/) or [docker](https://docs.docker.com/)

Clone this repository

```
git clone https://github.com/nethesis/nethvoice-cti.git
cd nethvoice-cti
```

Create the container image:

**Requires**

- Access to github.com/nethesis/nethesis-icons
- A valid token with _repo_ permission of your GitHub account

```
podman build --env ICONS_TOKEN=<YOUR_VALID_GH_TOKEN> -t ghcr.io/nethesis/nethvoice-cti .
```

_It returns the image_id._

**Note:** the image is automatically built on GitHub actions on each push.

## Deployment

The project can be deployed through containers.

It is possible to specify some variables through environment:

```
PRODUCT_NAME (default: "NethVoice CTI")
COMPANY_NAME (default: "Nethesis")
COMPANY_SUBNAME (default: "CTI")
COMPANY_URL (default: "https://www.nethesis.it/")
LOGIN_PEOPLE (rebranding of the login people image: it can be shown or hidden based on the value (show or hide string value))
NAVBAR_LOGO_URL (rebranding of navbar logo: specify a URL to a SVG image)
NAVBAR_LOGO_DARK_URL (rebranding of navbar logo: specify a URL to a SVG image)
LOGIN_LOGO_URL (rebranding of login logo: specify a URL to a SVG image)
LOGIN_LOGO_DARK_URL (rebranding of login logo in dark mode: specify a URL to a SVG image)
FAVICON_URL (used for rebranding: specify a URL to an ICO image)
LOGIN_BACKGROUND_URL (used for rebranding: specify a URL to a SVG image)
API_ENDPOINT (default: host + port + path)
API_SCHEME (default: current protocol ["http://"|"https://"])
WS_ENDPOINT (default: wss://host + port + path + "/ws")
SIP_HOST (default: "127.0.0.1")
SIP_PORT (default: "5060")
```
### Rebranding

To change the logos and background of application you have to set these enviroment variables (reference of variables type above):

- LOGIN_PEOPLE
- NAVBAR_LOGO_URL
- NAVBAR_LOGO_DARK_URL
- LOGIN_LOGO_URL
- LOGIN_LOGO_DARK_URL
- FAVICON_URL
- LOGIN_BACKGROUND_URL

### Running

Run the container specifying an API endpoint :

```
podman run --rm --name nethvoice-cti --env='API_ENDPOINT=nethvoice.nethesis.it' -p 3000:3000/tcp ghcr.io/nethesis/nethvoice-cti:latest
```

Run the container with custom logos and background :

```
podman run --tz='Europe/Rome' --rm --name nethvoice-cti \
  --env='API_ENDPOINT=cti.nethesis.it' \
  --env='API_SCHEME=https://' \
  --env='LOGIN_PEOPLE=hide' \
  --env="TIMEZONE=Europe/Rome" \
  --env="HOST=127.0.0.1" \
  --env='LOGIN_BACKGROUND_URL=https://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg' \
  --env='FAVICON_URL=https://www.favicon.cc/logo3d/85805.png' \
  --env='NAVBAR_LOGO_URL=https://upload.wikimedia.org/wikipedia/commons/8/80/Atom_editor_logo.svg' \
  --env='NAVBAR_LOGO_DARK_URL=https://upload.wikimedia.org/wikipedia/commons/8/80/Atom_editor_logo.svg' \
  --env='LOGIN_LOGO_URL=https://upload.wikimedia.org/wikipedia/commons/4/4f/SVG_Logo.svg' \
  --env='LOGIN_LOGO_DARK_URL=https://upload.wikimedia.org/wikipedia/commons/4/4f/SVG_Logo.svg' \
  -p 3000:3000 ghcr.io/nethesis/nethvoice-cti:latest
```

_If port 3000 is already in use, replace it with a free one._

The project will be available on localhost:3000

## Dark mode and custom color palette

CTI color palette is defined in `tailwind.config.js` and consists of five shades of a primary color (currently green). These five shades are named:

- `primary`
- `primaryLighter`
- `primaryLight`
- `primaryDark`
- `primaryDarker`

Most of UI components are derived from [Tailwind UI](https://tailwindui.com/). Tailwind code needs to be adapted to use CTI color palette and to support dark mode, so:

- every Tailwind class that is color related (e.g. `bg-sky-100`, `text-indigo-600`) needs to be changed in order to use CTI color palette
- for every Tailwind class that is color related, a `dark:` class must be added to specify the color used in dark mode

See next paragraphs for details.

### Change Tailwind color related classes

Tailwind CSS represents color shades with numbers from 50 (lightest) to 900 (darkest). Here are some examples to adapt color related classes included in Tailwind components for CTI color palette:

- `bg-sky-600` becomes `bg-primary`
- `bg-sky-700` becomes `bg-primaryDark`
- `text-sky-900` becomes `text-primaryDarker`
- `border-sky-100` becomes `border-primaryLighter`
- `ring-sky-500` becomes `ring-primaryLight`

### Add Tailwind classes to support dark mode

- Never use `white` and `black` colors in dark mode. Use `gray-100` (very light gray) and `gray-900` (very dark gray) instead
- The sum of color shades in light and dark mode should be about 900 (e.g. 100+800, 300+600, 400+500). In dark mode light colors become dark, and dark colors become light
- Sometimes, little manual adjustments are needed (e.g. to make an icon more legible in dark mode)
- Some examples:
  - `bg-white`: add class `dark:bg-gray-900` (don't use `black`)
  - `bg-gray-100`: add class `dark:bg-gray-800`
  - `bg-gray-400`: add class `dark:bg-gray-500`
  - `text-gray-600`: add class `dark:text-gray-300`
  - `text-gray-900`: add class `dark:text-gray-100` (don't use `white`)
  - `bg-primary`: add class `dark:bg-primary` (primary color is unchanged in dark mode)
  - `ring-primaryLight`: add class `dark:ring-primaryDark`
  - `text-primaryDarker`: add class `dark:text-primaryLighter`

More examples are included [in this PR](https://github.com/nethesis/nethvoice-cti/pull/26)
