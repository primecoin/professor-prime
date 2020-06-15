from flask import Flask, render_template
app = Flask(__name__,
            static_url_path='', 
            static_folder='web',
            template_folder='web')

@app.route("/")
def index():
    return render_template("index.html")

# include this for local dev
# if __name__ == '__main__':
#     app.run()