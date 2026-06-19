/**
 * Coding Showdown — Python Basic (ma trận thầy Hưng + bộ cũ).
 * Nguồn: Ma_tran_de_Coding_Showdown_Python_Basic.docx + ma trận gốc MindX (không turtle).
 *
 * Vòng 1: 80 câu mới + 71 câu cũ (R1-Lxx, không turtle) = 151 câu vấn đáp.
 * Vòng 2: 20 câu mới + 19 câu cũ (R2-Lxx, không turtle) = 39 câu chướng ngại.
 * Vòng 3: 120 câu viết code (GV chấm).
 */
import { LEGACY_R1, LEGACY_R2 } from './showdownLegacyBank.js';

const R1 = [
  ['R1-01', 'io', `Lệnh nào dùng để in dữ liệu ra màn hình?`, `print()`, 'easy'],
  ['R1-02', 'io', `input() dùng để làm gì?`, `Nhận dữ liệu từ bàn phím`, 'easy'],
  ['R1-03', 'io', `input() luôn trả về kiểu dữ liệu gì?`, `str / chuỗi`, 'medium'],
  ['R1-04', 'variables', `Tên biến student_name có hợp lệ không?`, `Có`, 'easy'],
  ['R1-05', 'variables', `Tên biến 2score có hợp lệ không?`, `Không`, 'easy'],
  ['R1-06', 'variables', `Python có phân biệt chữ hoa và chữ thường không?`, `Có`, 'easy'],
  ['R1-07', 'variables', `10 thuộc kiểu dữ liệu nào?`, `int`, 'easy'],
  ['R1-08', 'variables', `3.14 thuộc kiểu dữ liệu nào?`, `float`, 'easy'],
  ['R1-09', 'variables', `"Hello" thuộc kiểu dữ liệu nào?`, `str`, 'easy'],
  ['R1-10', 'variables', `True thuộc kiểu dữ liệu nào?`, `bool`, 'easy'],
  ['R1-11', 'variables', `int("5") + 2 bằng bao nhiêu?`, `7`, 'medium'],
  ['R1-12', 'variables', `float("2.5") trả về gì?`, `2.5`, 'medium'],
  ['R1-13', 'operators', `10 // 3 bằng bao nhiêu?`, `3`, 'easy'],
  ['R1-14', 'operators', `10 % 3 bằng bao nhiêu?`, `1`, 'easy'],
  ['R1-15', 'operators', `2 ** 3 bằng bao nhiêu?`, `8`, 'easy'],
  ['R1-16', 'operators', `3 + 2 * 4 bằng bao nhiêu?`, `11`, 'medium'],
  ['R1-17', 'operators', `Toán tử so sánh bằng trong Python là gì?`, `==`, 'easy'],
  ['R1-18', 'operators', `Toán tử khác trong Python là gì?`, `!=`, 'easy'],
  ['R1-19', 'conditionals', `5 > 3 trả về True hay False?`, `True`, 'easy'],
  ['R1-20', 'conditionals', `5 > 3 and 2 > 4 trả về gì?`, `False`, 'medium'],
  ['R1-21', 'conditionals', `5 > 3 or 2 > 4 trả về gì?`, `True`, 'medium'],
  ['R1-22', 'conditionals', `not True trả về gì?`, `False`, 'easy'],
  ['R1-23', 'conditionals', `Từ khóa bắt đầu câu điều kiện là gì?`, `if`, 'easy'],
  ['R1-24', 'conditionals', `Từ khóa điều kiện phụ là gì?`, `elif`, 'easy'],
  ['R1-25', 'conditionals', `else có cần điều kiện phía sau không?`, `Không`, 'easy'],
  ['R1-26', 'conditionals', `Dấu : sau if dùng để làm gì?`, `Mở khối lệnh`, 'medium'],
  ['R1-27', 'custom', `Lỗi thụt lề gọi là lỗi gì?`, `IndentationError`, 'medium'],
  ['R1-28', 'custom', `Ký tự comment một dòng là gì?`, `#`, 'easy'],
  ['R1-29', 'loops', `Vòng lặp biết trước số lần lặp thường dùng gì?`, `for`, 'easy'],
  ['R1-30', 'loops', `Vòng lặp chưa biết trước số lần lặp thường dùng gì?`, `while`, 'easy'],
  ['R1-31', 'loops', `range(5) tạo ra các số nào?`, `0, 1, 2, 3, 4`, 'medium'],
  ['R1-32', 'loops', `range(1, 4) tạo ra các số nào?`, `1, 2, 3`, 'medium'],
  ['R1-33', 'loops', `range(2, 10, 2) tạo ra gì?`, `2, 4, 6, 8`, 'hard'],
  ['R1-34', 'loops', `break dùng để làm gì?`, `Thoát khỏi vòng lặp`, 'medium'],
  ['R1-35', 'loops', `continue dùng để làm gì?`, `Bỏ qua lượt lặp hiện tại`, 'medium'],
  ['R1-36', 'loops', `while True thường tạo vòng lặp gì?`, `Vòng lặp vô hạn`, 'medium'],
  ['R1-37', 'lists', `Chỉ số đầu tiên của list là gì?`, `0`, 'easy'],
  ['R1-38', 'lists', `[10,20,30][0] bằng bao nhiêu?`, `10`, 'easy'],
  ['R1-39', 'lists', `[10,20,30][1] bằng bao nhiêu?`, `20`, 'easy'],
  ['R1-40', 'lists', `len([1,2,3]) bằng bao nhiêu?`, `3`, 'easy'],
  ['R1-41', 'lists', `append() thêm phần tử vào đâu?`, `Cuối list`, 'easy'],
  ['R1-42', 'lists', `pop() mặc định xóa phần tử ở đâu?`, `Cuối list`, 'medium'],
  ['R1-43', 'lists', `remove(x) xóa theo gì?`, `Giá trị x`, 'medium'],
  ['R1-44', 'lists', `sort() dùng để làm gì?`, `Sắp xếp list`, 'medium'],
  ['R1-45', 'lists', `max([1,5,2]) bằng bao nhiêu?`, `5`, 'easy'],
  ['R1-46', 'lists', `min([1,5,2]) bằng bao nhiêu?`, `1`, 'easy'],
  ['R1-47', 'lists', `sum([1,2,3]) bằng bao nhiêu?`, `6`, 'easy'],
  ['R1-48', 'lists', `5 in [1,5,9] trả về gì?`, `True`, 'medium'],
  ['R1-49', 'strings', `len("Python") bằng bao nhiêu?`, `6`, 'easy'],
  ['R1-50', 'strings', `"Python"[0] là gì?`, `P`, 'easy'],
  ['R1-51', 'strings', `"Python"[-1] là gì?`, `n`, 'medium'],
  ['R1-52', 'strings', `"hi" * 3 trả về gì?`, `hihihi`, 'medium'],
  ['R1-53', 'strings', `"1" + "2" trả về gì?`, `"12"`, 'easy'],
  ['R1-54', 'strings', `"python".upper() trả về gì?`, `PYTHON`, 'easy'],
  ['R1-55', 'strings', `"PYTHON".lower() trả về gì?`, `python`, 'easy'],
  ['R1-56', 'strings', `"a" in "apple" trả về gì?`, `True`, 'easy'],
  ['R1-57', 'strings', `"hello"[1:4] trả về gì?`, `ell`, 'hard'],
  ['R1-58', 'functions', `Từ khóa định nghĩa hàm là gì?`, `def`, 'easy'],
  ['R1-59', 'functions', `Từ khóa trả về giá trị trong hàm là gì?`, `return`, 'easy'],
  ['R1-60', 'functions', `Tham số của hàm đặt ở đâu?`, `Trong dấu ngoặc ()`, 'medium'],
  ['R1-61', 'functions', `Hàm có bắt buộc phải có return không?`, `Không`, 'medium'],
  ['R1-62', 'debug', `NameError thường xảy ra khi nào?`, `Dùng biến chưa được định nghĩa`, 'medium'],
  ['R1-63', 'debug', `SyntaxError là lỗi gì?`, `Lỗi cú pháp`, 'easy'],
  ['R1-64', 'debug', `TypeError có thể xảy ra khi cộng str với int không?`, `Có`, 'medium'],
  ['R1-65', 'operators', `abs(-7) bằng bao nhiêu?`, `7`, 'easy'],
  ['R1-66', 'operators', `round(3.14159, 2) bằng bao nhiêu?`, `3.14`, 'medium'],
  ['R1-67', 'io', `Muốn nhập tuổi dạng số nguyên dùng gì?`, `int(input())`, 'medium'],
  ['R1-68', 'io', `print("A", "B") mặc định cách nhau bằng gì?`, `Dấu cách`, 'hard'],
  ['R1-69', 'conditionals', `Nếu if sai thì chương trình có thể kiểm tra gì tiếp?`, `elif hoặc else`, 'easy'],
  ['R1-70', 'conditionals', `Điều kiện n chẵn viết thế nào?`, `n % 2 == 0`, 'medium'],
  ['R1-71', 'conditionals', `Điều kiện n lẻ viết thế nào?`, `n % 2 != 0`, 'medium'],
  ['R1-72', 'loops', `for i in range(3) lặp mấy lần?`, `3 lần`, 'easy'],
  ['R1-73', 'loops', `i += 1 tương đương với gì?`, `i = i + 1`, 'easy'],
  ['R1-74', 'loops', `Thiếu i += 1 trong while có thể gây lỗi gì?`, `Vòng lặp vô hạn`, 'medium'],
  ['R1-75', 'lists', `List có thể chứa nhiều kiểu dữ liệu không?`, `Có`, 'easy'],
  ['R1-76', 'lists', `A[0] = 10 là thao tác gì?`, `Cập nhật phần tử đầu tiên`, 'medium'],
  ['R1-77', 'strings', `Chuỗi có thay đổi trực tiếp từng kí tự được không?`, `Không`, 'hard'],
  ['R1-78', 'functions', `Gọi hàm hello viết như thế nào?`, `hello()`, 'easy'],
  ['R1-79', 'custom', `x = "5"; int(x) * 2 bằng bao nhiêu?`, `10`, 'medium'],
  ['R1-80', 'custom', `15 / 3 trả về kiểu dữ liệu gì?`, `float`, 'hard'],
].map(([id, topic, prompt, correctAnswer, difficulty]) => ({
  id: `sd-${id}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'startup',
  bankRound: 'startup',
  difficulty,
  questionType: 'oral',
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer,
  correctIndex: null,
  starterCode: '',
  referenceSolution: '',
  explanation: '',
  timeLimitSeconds: 5,
  points: 10,
}));

const R2 = [
  ['R2-01', 'debug', 'code', `Tìm lỗi sai:

if x = 5:    
print("OK")`, `x = 5 phải sửa thành x == 5`],
  ['R2-02', 'debug', 'code', `Tìm lỗi sai:

for i in range(5)    
print(i)`, `Thiếu dấu : sau range(5)`],
  ['R2-03', 'debug', 'code', `Tìm lỗi sai:

if age >= 18:
print("Adult")`, `Dòng print phải thụt vào trong if`],
  ['R2-04', 'debug', 'code', `Đoạn code lỗi ở đâu?
age = input()
if age >= 18:    
print("OK")`, `input() trả về str, cần age = int(input())`],
  ['R2-05', 'output', 'short_answer', `Dự đoán kết quả:
x = 10
x = 20
print(x)`, `20`],
  ['R2-06', 'output', 'short_answer', `Dự đoán kết quả:
print(3 + 2 * 5)`, `13`],
  ['R2-07', 'conditionals', 'short_answer', `Điền điều kiện kiểm tra số chẵn của n`, `n % 2 == 0`],
  ['R2-08', 'conditionals', 'short_answer', `Điền điều kiện: điểm từ 0 đến 10`, `0 <= score <= 10`],
  ['R2-09', 'loops', 'code', `Vì sao vòng lặp vô hạn?
i = 0
while i < 5:    
print(i)`, `Thiếu i += 1`],
  ['R2-10', 'output', 'short_answer', `Kết quả:
for i in range(1,4):
    print(i)`, `1 2 3, mỗi số một dòng`],
  ['R2-11', 'output', 'short_answer', `Kết quả:
for i in range(0,6,2):
    print(i)`, `0 2 4, mỗi số một dòng`],
  ['R2-12', 'lists', 'short_answer', `Lấy phần tử cuối cùng của list A`, `A[-1]`],
  ['R2-13', 'lists', 'code', `Sửa lỗi:
A = [1,2,3]
print(A[3])`, `Chỉ số cuối là 2; dùng A[2] hoặc A[-1]`],
  ['R2-14', 'lists', 'code', `Thêm tên "An" vào list students`, `students.append("An")`],
  ['R2-15', 'strings', 'short_answer', `Đảo ngược chuỗi s bằng slicing`, `s[::-1]`],
  ['R2-16', 'strings', 'short_answer', `Lấy 3 kí tự đầu của chuỗi s`, `s[:3]`],
  ['R2-17', 'functions', 'short_answer', `Hoàn thành hàm:
def square(n):
    ___ n*n`, `return`],
  ['R2-18', 'loops', 'code', `Sắp xếp bước tính tổng 1 đến n:
A. s += i
B. s = 0
C. for i in range(1, n+1)
D. print(s)`, `B -> C -> A -> D`],
  ['R2-19', 'debug', 'code', `Lỗi gì?
name = "Hưng"
print(Name)`, `NameError do sai chữ hoa/thường: Name khác name`],
  ['R2-20', 'output', 'short_answer', `Kết quả:A = [1,2]A.
append(3)print(len(A))`, `3`],
].map(([id, topic, questionType, prompt, ans]) => ({
  id: `sd-${id}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'obstacle',
  bankRound: 'acceleration',
  difficulty: 'medium',
  questionType,
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer: questionType === 'short_answer' ? ans : '',
  correctIndex: null,
  starterCode: '',
  referenceSolution: questionType === 'code' ? ans : '',
  explanation: '',
  timeLimitSeconds: 25,
  points: 20,
}));

const R3 = [
  ['R3-E-01', 'io', 'easy', `Nhập tên và in: Xin chào <tên>`, `name = input("Nhập tên: ")
print("Xin chào", name)`],
  ['R3-E-02', 'variables', 'easy', `Tạo biến age = 15 và in ra màn hình`, `age = 15
print(age)`],
  ['R3-E-03', 'operators', 'easy', `Tính tổng hai số a = 5, b = 7`, `a = 5
b = 7
print(a + b)`],
  ['R3-E-04', 'operators', 'easy', `Tính diện tích hình chữ nhật dài 10, rộng 5`, `print(10 * 5)`],
  ['R3-E-05', 'variables', 'easy', `Nhập tuổi dạng số nguyên`, `age = int(input("Nhập tuổi: "))`],
  ['R3-E-06', 'operators', 'easy', `In phần dư của 17 chia 5`, `print(17 % 5)`],
  ['R3-E-07', 'conditionals', 'easy', `Nếu n > 0 thì in “Dương”`, `if n > 0:
    print("Dương")`],
  ['R3-E-08', 'conditionals', 'easy', `Nếu n chẵn thì in “Chẵn”`, `if n % 2 == 0:
    print("Chẵn")`],
  ['R3-E-09', 'conditionals', 'easy', `Nhập điểm, nếu >= 5 in “Đậu”, ngược lại in “Rớt”`, `score = float(input())
if score >= 5:
    print("Đậu")
else:
    print("Rớt")`],
  ['R3-E-10', 'loops', 'easy', `Dùng for in các số từ 0 đến 4`, `for i in range(5):
    print(i)`],
  ['R3-E-11', 'loops', 'easy', `In “Python” 5 lần`, `for i in range(5):
    print("Python")`],
  ['R3-E-12', 'loops', 'easy', `In các số từ 1 đến 5`, `for i in range(1, 6):
    print(i)`],
  ['R3-E-13', 'loops', 'easy', `Dùng while in số từ 1 đến 3`, `i = 1
while i <= 3:
    print(i)
    i += 1`],
  ['R3-E-14', 'lists', 'easy', `Tạo list rỗng tên students`, `students = []`],
  ['R3-E-15', 'lists', 'easy', `Tạo list chứa 3 số 1, 2, 3`, `nums = [1, 2, 3]`],
  ['R3-E-16', 'lists', 'easy', `Thêm số 10 vào cuối list nums`, `nums.append(10)`],
  ['R3-E-17', 'lists', 'easy', `In phần tử đầu tiên của list nums`, `print(nums[0])`],
  ['R3-E-18', 'lists', 'easy', `In số lượng phần tử trong list nums`, `print(len(nums))`],
  ['R3-E-19', 'strings', 'easy', `In độ dài của chuỗi “Python”`, `print(len("Python"))`],
  ['R3-E-20', 'strings', 'easy', `Đổi chuỗi s thành chữ hoa`, `print(s.upper())`],
  ['R3-E-21', 'strings', 'easy', `Kiểm tra chữ “a” có trong s hay không`, `if "a" in s:
    print("Có")`],
  ['R3-E-22', 'strings', 'easy', `In kí tự đầu tiên của s`, `print(s[0])`],
  ['R3-E-23', 'functions', 'easy', `Định nghĩa hàm say_hello() in “Hello”`, `def say_hello():
    print("Hello")`],
  ['R3-E-24', 'functions', 'easy', `Gọi hàm say_hello()`, `say_hello()`],
  ['R3-E-25', 'functions', 'easy', `Viết hàm cộng hai số a, b`, `def add(a, b):
    return a + b`],
  ['R3-E-26', 'operators', 'easy', `Tính chu vi hình vuông cạnh a`, `print(a * 4)`],
  ['R3-E-27', 'operators', 'easy', `Tính bình phương của n`, `print(n ** 2)`],
  ['R3-E-28', 'conditionals', 'easy', `Kiểm tra n khác 0`, `if n != 0:
    print("Khác 0")`],
  ['R3-E-29', 'lists', 'easy', `Xóa phần tử cuối của list A`, `A.pop()`],
  ['R3-E-30', 'strings', 'easy', `Nối first_name và last_name có dấu cách`, `print(first_name + " " + last_name)`],
  ['R3-E-31', 'variables', 'easy', `In kiểu dữ liệu của biến x`, `print(type(x))`],
  ['R3-E-32', 'io', 'easy', `Nhập một số thực từ bàn phím`, `x = float(input("Nhập số: "))`],
  ['R3-E-33', 'conditionals', 'easy', `Nếu mật khẩu là “123” thì in “Đúng”`, `if password == "123":
    print("Đúng")`],
  ['R3-E-34', 'loops', 'easy', `In các số chẵn từ 2 đến 10`, `for i in range(2, 11, 2):
    print(i)`],
  ['R3-E-35', 'lists', 'easy', `Tìm số lớn nhất trong list nums`, `print(max(nums))`],
  ['R3-E-36', 'lists', 'easy', `Tìm số nhỏ nhất trong list nums`, `print(min(nums))`],
  ['R3-E-37', 'strings', 'easy', `Cắt 3 kí tự đầu tiên của s`, `print(s[:3])`],
  ['R3-E-38', 'functions', 'easy', `Hàm is_even(n) trả về True nếu n chẵn`, `def is_even(n):
    return n % 2 == 0`],
  ['R3-E-39', 'debug', 'easy', `Viết comment một dòng nội dung “Bài làm của em”`, `# Bài làm của em`],
  ['R3-E-40', 'custom', 'easy', `Nhập tên, nhập tuổi, in tên và tuổi`, `name = input()
age = int(input())
print(name, age)`],
  ['R3-M-01', 'loops', 'medium', `Tính tổng các số từ 1 đến n`, `s = 0
for i in range(1, n + 1):
    s += i
print(s)`],
  ['R3-M-02', 'loops', 'medium', `Tính tổng các số chẵn từ 1 đến 20`, `s = 0
for i in range(1, 21):
    if i % 2 == 0:
    s += i
print(s)`],
  ['R3-M-03', 'conditionals', 'medium', `Nhập điểm và xếp loại: >=8 Giỏi, >=6.5 Khá, >=5 Trung bình, còn lại Cần cố gắng`, `d = float(input())
if d >= 8:
    print("Giỏi")
elif d >= 6.5:
    print("Khá")
elif d >= 5:
    print("Trung bình")
else:
    print("Cần cố gắng")`],
  ['R3-M-04', 'conditionals', 'medium', `Kiểm tra số dương, âm hay bằng 0`, `n = int(input())
if n > 0:
    print("Dương")
elif n < 0:
    print("Âm")
else:
    print("Bằng 0")`],
  ['R3-M-05', 'loops', 'medium', `Nhập mật khẩu đến khi đúng “python”`, `password = input()
while password != "python":
    password = input("Nhập lại: ")
print("Đăng nhập thành công")`],
  ['R3-M-06', 'loops', 'medium', `Đếm ngược từ 10 về 1`, `i = 10
while i >= 1:
    print(i)
    i -= 1`],
  ['R3-M-07', 'lists', 'medium', `Tính tổng các phần tử trong list nums không dùng sum()`, `s = 0
for x in nums:
    s += x
print(s)`],
  ['R3-M-08', 'lists', 'medium', `Tính trung bình cộng của list nums`, `total = sum(nums)
avg = total / len(nums)
print(avg)`],
  ['R3-M-09', 'lists', 'medium', `In các số lớn hơn 10 trong list nums`, `for x in nums:
    if x > 10:
    print(x)`],
  ['R3-M-10', 'lists', 'medium', `Nhập 5 số vào list nums`, `nums = []
for i in range(5):
    nums.append(int(input()))
print(nums)`],
  ['R3-M-11', 'lists', 'medium', `Đếm có bao nhiêu số chẵn trong list nums`, `count = 0
for x in nums:
    if x % 2 == 0:
    count += 1
print(count)`],
  ['R3-M-12', 'strings', 'medium', `Đếm số kí tự “a” trong chuỗi s`, `count = 0
for ch in s:
    if ch == "a":
    count += 1
print(count)`],
  ['R3-M-13', 'strings', 'medium', `In từng kí tự của chuỗi s trên mỗi dòng`, `for ch in s:
    print(ch)`],
  ['R3-M-14', 'strings', 'medium', `Đảo ngược chuỗi s`, `print(s[::-1])`],
  ['R3-M-15', 'strings', 'medium', `Chuẩn hóa tên: xóa khoảng trắng hai đầu và viết hoa chữ cái đầu mỗi từ`, `name = name.strip().title()
print(name)`],
  ['R3-M-16', 'functions', 'medium', `Viết hàm area_rect(w, h) trả về diện tích hình chữ nhật`, `def area_rect(w, h):
    return w * h`],
  ['R3-M-17', 'functions', 'medium', `Viết hàm max_two(a, b) trả về số lớn hơn`, `def max_two(a, b):
    if a > b:
    return a
return b`],
  ['R3-M-18', 'functions', 'medium', `Viết hàm count_even(nums) đếm số chẵn trong list`, `def count_even(nums):
    count = 0
for x in nums:
    if x % 2 == 0:
    count += 1
return count`],
  ['R3-M-19', 'operators', 'medium', `Đổi độ C sang độ F`, `c = float(input())
f = c * 1.8 + 32
print(f)`],
  ['R3-M-20', 'operators', 'medium', `Nhập số giây, đổi thành phút và giây`, `total = int(input())
minutes = total // 60
seconds = total % 60
print(minutes, "phút", seconds, "giây")`],
  ['R3-M-21', 'conditionals', 'medium', `Kiểm tra n có chia hết cho 3 và 5 không`, `n = int(input())
if n % 3 == 0 and n % 5 == 0:
    print("Có")
else:
    print("Không")`],
  ['R3-M-22', 'conditionals', 'medium', `Kiểm tra tuổi hợp lệ từ 6 đến 18`, `age = int(input())
if 6 <= age <= 18:
    print("Hợp lệ")
else:
    print("Không hợp lệ")`],
  ['R3-M-23', 'loops', 'medium', `In bảng cửu chương của n`, `n = int(input())
for i in range(1, 11):
    print(n, "x", i, "=", n * i)`],
  ['R3-M-24', 'loops', 'medium', `In hình vuông 4x4 dấu *`, `for i in range(4):
    print("*" * 4)`],
  ['R3-M-25', 'loops', 'medium', `In tam giác sao tăng dần 5 dòng`, `for i in range(1, 6):
    print("*" * i)`],
  ['R3-M-26', 'lists', 'medium', `Tạo list bình phương các số từ 1 đến 5`, `squares = []
for i in range(1, 6):
    squares.append(i ** 2)
print(squares)`],
  ['R3-M-27', 'lists', 'medium', `Xóa tất cả số âm khỏi list nums bằng list mới`, `new_nums = []
for x in nums:
    if x >= 0:
    new_nums.append(x)
print(new_nums)`],
  ['R3-M-28', 'strings', 'medium', `Kiểm tra chuỗi s có phải đối xứng không`, `if s == s[::-1]:
    print("Đối xứng")
else:
    print("Không")`],
  ['R3-M-29', 'io', 'medium', `Nhập n số và tính tổng`, `n = int(input())
s = 0
for i in range(n):
    s += int(input())
print(s)`],
  ['R3-M-30', 'debug', 'medium', `Sửa lỗi chia cho 0 khi tính a / b`, `if b != 0:
    print(a / b)
else:
    print("Không thể chia cho 0")`],
  ['R3-M-31', 'lists', 'medium', `Tìm vị trí đầu tiên của x trong list A`, `if x in A:
    print(A.index(x))
else:
    print("Không tìm thấy")`],
  ['R3-M-32', 'lists', 'medium', `Sắp xếp list nums tăng dần rồi in ra`, `nums.sort()
print(nums)`],
  ['R3-M-33', 'strings', 'medium', `Thay tất cả dấu cách trong s bằng dấu gạch ngang`, `s = s.replace(" ", "-")
print(s)`],
  ['R3-M-34', 'strings', 'medium', `Tách một câu thành list các từ`, `words = sentence.split()
print(words)`],
  ['R3-M-35', 'functions', 'medium', `Viết hàm grade(score) trả về Đậu/Rớt`, `def grade(score):
    if score >= 5:
    return "Đậu"
return "Rớt"`],
  ['R3-M-36', 'custom', 'medium', `Tính tiền mua hàng: nhập đơn giá, số lượng, in tổng tiền`, `price = int(input())
quantity = int(input())
total = price * quantity
print(total)`],
  ['R3-M-37', 'custom', 'medium', `Nếu tổng tiền >= 100000 thì giảm 10%, ngược lại không giảm`, `if total >= 100000:
    total = total * 0.9
print(total)`],
  ['R3-M-38', 'loops', 'medium', `Tìm số nhỏ nhất trong list nums không dùng min()`, `smallest = nums[0]
for x in nums:
    if x < smallest:
    smallest = x
print(smallest)`],
  ['R3-M-39', 'loops', 'medium', `Tìm số lớn nhất trong list nums không dùng max()`, `biggest = nums[0]
for x in nums:
    if x > biggest:
    biggest = x
print(biggest)`],
  ['R3-M-40', 'functions', 'medium', `Viết hàm calculate_tiles(room, tile) trả về số viên gạch cần dùng, làm tròn lên đơn giản`, `def calculate_tiles(room, tile):
    tiles = room // tile
if room % tile != 0:
    tiles += 1
return tiles`],
  ['R3-H-01', 'lists', 'hard', `Nhập n điểm vào list, in điểm cao nhất, thấp nhất và trung bình`, `n = int(input())
scores = []
for i in range(n):
    scores.append(float(input()))
print(max(scores))
print(min(scores))
print(sum(scores)/len(scores))`],
  ['R3-H-02', 'conditionals', 'hard', `In tất cả số chia hết cho 3 nhưng không chia hết cho 5 từ 1 đến n`, `n = int(input())
for i in range(1, n + 1):
    if i % 3 == 0 and i % 5 != 0:
    print(i)`],
  ['R3-H-03', 'loops', 'hard', `Cho người dùng nhập số đến khi nhập 0 thì dừng, sau đó in tổng`, `total = 0
n = int(input())
while n != 0:
    total += n
    n = int(input())
print(total)`],
  ['R3-H-04', 'lists', 'hard', `Tìm số lớn thứ hai trong list nums không có số trùng`, `nums.sort()
print(nums[-2])`],
  ['R3-H-05', 'lists', 'hard', `Tìm số lớn thứ hai trong list nums có thể có số trùng`, `unique = []
for x in nums:
    if x not in unique:
    unique.append(x)
unique.sort()
print(unique[-2])`],
  ['R3-H-06', 'strings', 'hard', `Đếm số nguyên âm a, e, i, o, u trong chuỗi s`, `count = 0
for ch in s.lower():
    if ch in "aeiou":
    count += 1
print(count)`],
  ['R3-H-07', 'strings', 'hard', `Kiểm tra mật khẩu mạnh: dài >= 8 và có ít nhất 1 chữ số`, `password = input()
has_digit = Falsefor ch in password:
    if ch.isdigit():
    has_digit = Trueif len(password) >= 8 and has_digit:
    print("Mạnh")
else:
    print("Yếu")`],
  ['R3-H-08', 'functions', 'hard', `Viết hàm is_prime(n) kiểm tra số nguyên tố`, `def is_prime(n):
    if n < 2:
    return False
for i in range(2, int(n**0.5) + 1):
    if n % i == 0:
    return False
return True`],
  ['R3-H-09', 'loops', 'hard', `In các số nguyên tố từ 2 đến n sử dụng hàm is_prime`, `n = int(input())
for i in range(2, n + 1):
    if is_prime(i):
    print(i)`],
  ['R3-H-10', 'loops', 'hard', `Tính giai thừa n bằng vòng lặp`, `n = int(input())
result = 1
for i in range(1, n + 1):
    result *= i
print(result)`],
  ['R3-H-11', 'lists', 'hard', `Xóa phần tử trùng lặp trong list nhưng giữ thứ tự`, `result = []
for x in nums:
    if x not in result:
    result.append(x)
print(result)`],
  ['R3-H-12', 'lists', 'hard', `Tách list nums thành hai list: chẵn và lẻ`, `even = []
odd = []
for x in nums:
    if x % 2 == 0:
    even.append(x)
else:
    odd.append(x)
print(even)
print(odd)`],
  ['R3-H-13', 'strings', 'hard', `Nhập họ tên nhiều khoảng trắng, chuẩn hóa còn một khoảng trắng và viết hoa đầu từ`, `name = input().strip()
parts = name.split()
name = " ".join(parts).title()
print(name)`],
  ['R3-H-14', 'strings', 'hard', `Đếm số từ trong một câu`, `sentence = input().strip()
if sentence == "":
    print(0)
else:
    words = sentence.split()
print(len(words))`],
  ['R3-H-15', 'custom', 'hard', `Tính hóa đơn: nhập giá 3 món vào list, nếu tổng > 200000 giảm 15%`, `prices = []
for i in range(3):
    prices.append(int(input()))
total = sum(prices)
if total > 200000:
    total *= 0.85
print(total)`],
  ['R3-H-16', 'conditionals', 'hard', `Tính tiền taxi: 1km đầu 15000, từ km 2 trở đi 12000/km`, `km = float(input())
if km <= 1:
    money = 15000
else:
    money = 15000 + (km - 1) * 12000
print(money)`],
  ['R3-H-17', 'loops', 'hard', `In bảng cửu chương từ 2 đến 9`, `for n in range(2, 10):
    for i in range(1, 11):
    print(n, "x", i, "=", n * i)
print("---")`],
  ['R3-H-18', 'loops', 'hard', `In tam giác số:112123... đến n dòng`, `n = int(input())
for i in range(1, n + 1):
    for j in range(1, i + 1):
    print(j, end="")
print()`],
  ['R3-H-19', 'lists', 'hard', `Tìm tất cả vị trí của số x trong list nums`, `positions = []
for i in range(len(nums)):
    if nums[i] == x:
    positions.append(i)
print(positions)`],
  ['R3-H-20', 'lists', 'hard', `Đếm số lần xuất hiện của x trong list nums không dùng count()`, `count = 0
for value in nums:
    if value == x:
    count += 1
print(count)`],
  ['R3-H-21', 'strings', 'hard', `Kiểm tra email đơn giản: có @ và có dấu . sau @`, `email = input()
if "@" in email and "." in email.split("@")[-1]:
    print("Hợp lệ")
else:
    print("Không hợp lệ")`],
  ['R3-H-22', 'strings', 'hard', `Ẩn số điện thoại: chỉ hiện 3 số cuối, còn lại là *`, `phone = input()
hidden = "*" * (len(phone) - 3) + phone[-3:]
print(hidden)`],
  ['R3-H-23', 'functions', 'hard', `Viết hàm sum_list(nums) tính tổng list không dùng sum()`, `def sum_list(nums):
    total = 0
for x in nums:
    total += x
return total`],
  ['R3-H-24', 'functions', 'hard', `Viết hàm find_min(nums) tìm số nhỏ nhất không dùng min()`, `def find_min(nums):
    smallest = nums[0]
for x in nums:
    if x < smallest:
    smallest = x
return smallest`],
  ['R3-H-25', 'functions', 'hard', `Viết hàm remove_negative(nums) trả về list không có số âm`, `def remove_negative(nums):
    result = []
for x in nums:
    if x >= 0:
    result.append(x)
return result`],
  ['R3-H-26', 'custom', 'hard', `Quản lý danh sách học sinh: nhập n tên, lưu vào list, in danh sách theo thứ tự nhập`, `n = int(input())
students = []
for i in range(n):
    students.append(input())
for name in students:
    print(name)`],
  ['R3-H-27', 'custom', 'hard', `Tìm học sinh trong list: nhập tên cần tìm, in Có/Không`, `target = input()
if target in students:
    print("Có")
else:
    print("Không")`],
  ['R3-H-28', 'custom', 'hard', `Danh sách điểm: in các bạn đạt từ 8 điểm trở lên`, `for score in scores:
    if score >= 8:
    print(score)`],
  ['R3-H-29', 'custom', 'hard', `Game đoán số đơn giản: số đúng là 7, nhập đến khi đoán đúng`, `guess = int(input())
while guess != 7:
    if guess > 7:
    print("Bé hơn")
else:
    print("Lớn hơn")
    guess = int(input())
print("Đúng")`],
  ['R3-H-30', 'operators', 'hard', `Đổi tổng số giây thành giờ, phút, giây`, `total = int(input())
h = total // 3600
remain = total % 3600
m = remain // 60
s = remain % 60
print(h, "giờ", m, "phút", s, "giây")`],
  ['R3-H-31', 'operators', 'hard', `Kiểm tra số chính phương`, `n = int(input())
r = int(n ** 0.5)
if r * r == n:
    print("Chính phương")
else:
    print("Không")`],
  ['R3-H-32', 'operators', 'hard', `Tìm ước của n`, `n = int(input())
for i in range(1, n + 1):
    if n % i == 0:
    print(i)`],
  ['R3-H-33', 'operators', 'hard', `Đếm số ước của n`, `count = 0
for i in range(1, n + 1):
    if n % i == 0:
    count += 1
print(count)`],
  ['R3-H-34', 'conditionals', 'hard', `Kiểm tra 3 cạnh có tạo thành tam giác không`, `a = float(input())
b = float(input())
c = float(input())
if a + b > c and a + c > b and b + c > a:
    print("Tam giác")
else:
    print("Không")`],
  ['R3-H-35', 'strings', 'hard', `Kiểm tra chuỗi chỉ gồm chữ số hay không không dùng isdigit()`, `s = input()
ok = Truefor ch in s:
    if ch < "0" or ch > "9":
    ok = Falseif ok:
    print("Toàn số")
else:
    print("Không")`],
  ['R3-H-36', 'strings', 'hard', `Đếm chữ cái, chữ số và kí tự khác trong chuỗi`, `letters = digits = others = 0
for ch in s:
    if ch.isalpha():
    letters += 1
elif ch.isdigit():
    digits += 1
else:
    others += 1
print(letters, digits, others)`],
  ['R3-H-37', 'lists', 'hard', `Đảo ngược list không dùng reverse()`, `reversed_list = []
for i in range(len(nums)-1, -1, -1):
    reversed_list.append(nums[i])
print(reversed_list)`],
  ['R3-H-38', 'lists', 'hard', `Dịch trái list một lần: [1,2,3] -> [2,3,1]`, `if len(nums) > 0:
    first = nums.pop(0)
    nums.append(first)
print(nums)`],
  ['R3-H-39', 'functions', 'hard', `Viết hàm login(username, password), đúng khi admin/123`, `def login(username, password):
    if username == "admin" and password == "123":
    return True
return False`],
  ['R3-H-40', 'custom', 'hard', `Mini menu 3 lựa chọn: 1 thêm tên, 2 xem danh sách, 0 thoát`, `students = []
choice = input()
while choice != "0":
    if choice == "1":
    students.append(input("Tên: "))
elif choice == "2":
    print(students)
    choice = input()`],
].map(([id, topic, difficulty, prompt, sol]) => ({
  id: `sd-${id}`,
  subject: 'Python',
  level: 'Basic',
  topic,
  round: 'finish',
  bankRound: 'finish',
  difficulty,
  questionType: 'code',
  prompt,
  codeSnippet: null,
  options: [],
  correctAnswer: '',
  correctIndex: null,
  starterCode: '',
  referenceSolution: sol,
  explanation: '',
  timeLimitSeconds: difficulty === 'easy' ? 20 : difficulty === 'medium' ? 60 : 120,
  points: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30,
}));

export const SHOWDOWN_MATRIX_BANK = [...R1, ...LEGACY_R1, ...R2, ...LEGACY_R2, ...R3];
