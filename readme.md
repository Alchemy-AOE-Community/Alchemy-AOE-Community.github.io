# Readme 

## Get the site running locally 
This project is build with jekyll 

First install jekyll locally. See the [https://jekyllrb.com/docs/installation/](Jekyll installation guides)

Once you have installed jekyll you can get the site running locally with the following commands: 
`cd ./site/`
`bundle exec jekyll serve --livereload`

If you did everything correctly the site should be available at http://localhost:4000

## Adding a new competition
To set-up a new competition there's a few things to do and configure. 

### Creating the competition 
To create a new competition create a new file in the `site/_competitions/` folder. You can simply copy one of the earlier files to make sure you have all the correct properties. We'll call this file the `competition file` for future reference. 
When the competition file is created make sure to fill out the fields correctly to reflect the new competition. 

### Adding the competition resources
After the competition file is created it will look for the resources (such as Competition image, definition, Registration and Seeding) in the `resources/<competition_name>` folder. The `competition_name` is defined in the competition file we made earlier, so these should mach (this is case sensitive). 
After the folder is created the resources for each sprint should be placed in their specific sprint folder as defined by the `sprint_name` in the competion file.