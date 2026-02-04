# GLACIER

[![GLACIER](https://github.com/ARTIC-Kraemer-Lab/GLACIER/actions/workflows/GLACIER.yml/badge.svg)](https://github.com/ARTIC-Kraemer-Lab/GLACIER/actions/workflows/GLACIER.yml) [![Documentation Status](https://readthedocs.org/projects/glacier/badge/?version=latest)](https://glacier.readthedocs.io/en/latest/?badge=latest)

**G**raphical **L**aunchpad for **A**nalysis,**C**omputation, **I**nference and **E**xplication of **R**esults

Documentation: [ReadTheDocs](https://glacier.readthedocs.io/en/latest)

## Quick start

To build and run the electron app:

```
npm install
npm start
```

You can also package the app for distribution (the app will be placed in `/dist`):

```
npm run dist
```

## Usage

Within the application:

- Click Actions - Add a Catalogue, and enter e.g. `artic-network`
- Click Install, then Run on a workflow card to launch the container/workflow

## Web deployment

The application is build using Electron, but this repository also supports web server deployment. To run the web server, run `npm run server` (after building the app). This will serve the electron front-end while providing an API that calls the backend code. The same code is as in the electron app, noting that the API interface must be maintained in-line with Electron's interface (see `src/renderer/services/api.ts`).
