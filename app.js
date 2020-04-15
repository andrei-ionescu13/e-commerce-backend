const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const productRoutes = require('./routes/product');
const categoryRoutes = require('./routes/category');
const userRoutes = require('./routes/user');
const tokenRoutes = require('./routes/token');
const reviewRouter = require('./routes/review');
const questionRouter = require('./routes/question');
const adminRouter = require('./routes/admin');
const orderRouter = require('./routes/order');
const cookieParser = require('cookie-parser');
const productInformationRouter = require('./routes/productInformation');
require('dotenv').config();

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

const app = express();

app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});

mongoose
	.connect(process.env.DB_HOST, {
		useNewUrlParser: true,
		useUnifiedTopology: true
	})
	.then(() => console.log('connected to database'))
	.catch((err) => console.log('Eroare la conectarea la baza de date: ' + err));

app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/token', tokenRoutes);

app.use('/question', questionRouter);
app.use('/product', productRoutes);
app.use('/category', categoryRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRouter);
app.use('/review', reviewRouter);
app.use('/order', orderRouter);
app.use('/productInformation', productInformationRouter);

const port = process.env.PORT || 3333;

app.listen(port, () => console.log(`server started on port ${port}`));
