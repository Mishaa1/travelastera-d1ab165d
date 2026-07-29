# Safara AI Navigator

Read the entire prompt before writing any code.

You are building the MVP of a startup called Safara

IMPORTANT

This is NOT another itinerary planner.

This product is an AI Travel Optimiser.

The goal is NOT to tell users where to go after they choose a destination.

The goal is to discover the BEST possible trip given the user's:

• Budget

• Dates

• Starting city

• Ending city

• Interests

• Preferred transport

• Maximum travel time

• Accommodation preference

Think of it as ChatGPT + Google Flights + Booking + Skyscanner + Wanderlog + Rome2Rio, but focused on optimisation instead of booking.

The optimisation engine is the product.

--------------------------------------------------

TECH STACK

Use:

• React

• TypeScript

• TailwindCSS

• shadcn/ui

• Framer Motion

• React Router

• Local Storage

• Lucide Icons

Project must be modular.

Organise folders properly.

Components must be reusable.

--------------------------------------------------

DESIGN STYLE

The website should feel like a premium travel company.

Think:

Apple

Airbnb

Linear

Notion

Rivian

NOT:

Bootstrap dashboard

Admin panel

Generic SaaS

Use:

• Large destination photography

• Huge spacing

• Beautiful typography

• Rounded cards

• Glassmorphism only where appropriate

• Soft shadows

• Smooth animations

• Floating cards

• Gradient backgrounds

• Elegant maps

• Large destination cards

Everything should feel luxurious.

Micro interactions should exist everywhere.

Hover animations.

Smooth page transitions.

Loading skeletons.

Animated counters.

Animated maps.

Subtle parallax.

Beautiful empty states.

--------------------------------------------------

COLOUR PALETTE

Background

Warm white

Accent

Deep blue

Teal

Emerald

Sunset orange

Minimal black.

--------------------------------------------------

LANDING PAGE

Hero

Large headline

"See how far your budget can take you."

Subheading

Stop comparing hundreds of websites.

We'll build your best possible trip automatically.

CTA

Primary

Find trips within my budget

Secondary

Try a sample trip

Below hero

Interactive search widget.

As user changes

Budget

Dates

Destination

The background route animation changes.

--------------------------------------------------

SECTIONS

How it works

1.

Tell us your budget

↓

2.

AI searches thousands of combinations

↓

3.

Receive your best trip

Interactive comparison

Compare:

Traditional planning

vs

SAFARA

Animated metrics.

Feature cards

Budget optimisation

Nearby destinations

Hidden gems

Trip bundles

Weather

Accommodation

Transport

Route optimisation

Testimonials

Use mock testimonials.

FAQ

Footer

--------------------------------------------------

TRIP PLANNER

Beautiful wizard.

Progress bar.

Auto save progress.

Steps

Step 1

Start city

End city

Dates

Travellers

Budget

Step 2

Interests

Nature

Food

Shopping

Photography

History

Museums

Nightlife

Adventure

Luxury

Step 3

Transport

Flight

Train

Car

Mixed

Max travel time

Avoid flights

Fewer hotel changes

Luxury level

--------------------------------------------------

RESULTS PAGE

Show FOUR AI generated routes.

Cards should look amazing.

Each contains

Large image

Route

Countries

Cities

Trip score

Cost

Budget left

Experience score

Nature score

Food score

Weather score

Travel efficiency

Journey time

Nearby day trips

Hotel suggestion

Transport recommendation

Buttons

View itinerary

Save

Compare

Optimise further

--------------------------------------------------

OPTIMISE FURTHER

Allow

Spend less

Reduce travel

Add another city

More nature

More luxury

Avoid flights

Recalculate animation.

--------------------------------------------------

DETAIL PAGE

Timeline itinerary.

Interactive route.

Budget breakdown.

Morning

Afternoon

Evening

Restaurants

Transport

Suggested hotels

Nearby places

Packing list

Weather

Alternative rainy day plans.

Explain WHY the AI chose this route.

--------------------------------------------------

SAVED TRIPS

Store in Local Storage.

Allow compare.

Rename.

Delete.

--------------------------------------------------

API ARCHITECTURE

Create an /api folder and a /services folder.

Even if some APIs are mocked.

Architecture must allow replacing mocks with live APIs later.

Create service files for

weatherService

flightService

hotelService

mapService

geocodeService

tripOptimizer

Do NOT hardcode API logic into components.

--------------------------------------------------

USE THESE FREE APIs

Map

MapLibre

OpenStreetMap

Weather

Open-Meteo

Geocoding

Nominatim

Flights

Create the service using Amadeus Self-Service API structure.

Use mock responses if API keys are missing.

Hotels

Create hotel service using mock data.

Architecture should allow replacing with Booking.com or Skyscanner later.

--------------------------------------------------

VERY IMPORTANT

Never show fake prices pretending they are live.

Always display

Estimated

or

Live

Badges.

If mock data is used

Show

Prototype Estimate

--------------------------------------------------

UI DETAILS

Every page should contain delightful interactions.

Examples

Destination cards lift on hover.

Animated gradients.

Scrolling reveals.

Floating search box.

Animated route drawing.

Trip score counts up.

Budget slider animates.

Buttons ripple.

Smooth loading.

Everything should feel premium.

--------------------------------------------------

MOBILE

Do NOT simply shrink desktop.

Design mobile first.

Bottom navigation.

Sticky CTA.

Large tap targets.

Swipeable cards.

--------------------------------------------------

DO NOT ADD

Authentication

Stripe

Payments

Admin dashboard

User profiles

Booking system

Real hotel booking

Real flight booking

Focus entirely on making the best AI travel optimisation experience possible.

--------------------------------------------------

At the end,

review the whole project,

remove duplicated code,

improve accessibility,

improve responsiveness,

optimise performance,

and make the project production-ready for future API integrations.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://travelastera.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/470c20cb-5c06-46ff-ab7a-ea4ca5d68c7a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
